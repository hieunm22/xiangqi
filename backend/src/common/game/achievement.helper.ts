import prisma from "prisma"
import redis from "../redis"
import type { Prisma } from "../../generated/prisma"
import { ACHIEVEMENT_TITLE, DRAW_50_THRESHOLD, WIN_100_THRESHOLD } from "./achievement.constant"
import { CachedAchievement } from "types/game.type"

// The achievement catalog is static reference data stored in redis
const ACHIEVEMENTS_CACHE_KEY = "cache:achievements"
const ACHIEVEMENTS_CACHE_TTL_SECONDS = 60 * 60 * 24 * 365 // 1 year

export async function refreshAchievementsCache(): Promise<CachedAchievement[]> {
	const achievements = await prisma.achievement.findMany({
		orderBy: { id: "asc" },
		select: { id: true, name: true }
	})

	try {
		const serializable = achievements.map(row => ({ id: row.id.toString(), name: row.name }))
		await redis.set(ACHIEVEMENTS_CACHE_KEY, JSON.stringify(serializable), "EX", ACHIEVEMENTS_CACHE_TTL_SECONDS)
	} catch (err) {
		console.error("[Achievements] cache write failed:", err)
	}

	return achievements
}

// Return the full achievement catalog from Redis.
export async function getCachedAchievements(): Promise<CachedAchievement[]> {
	try {
		const cached = await redis.get(ACHIEVEMENTS_CACHE_KEY)
		if (cached) {
			const parsed = JSON.parse(cached)
			if (Array.isArray(parsed)) {
				return parsed.map((row: { id: string; name: string }) => ({ id: BigInt(row.id), name: row.name }))
			}
		}
	} catch (err) {
		console.error("[Achievements] cache read failed, rebuilding from DB:", err)
	}

	return refreshAchievementsCache()
}

// Drop the cached catalog; call after mutating the achievement table so the next
// read repopulates from the DB.
export async function invalidateAchievementsCache(): Promise<void> {
	try {
		await redis.del(ACHIEVEMENTS_CACHE_KEY)
	} catch (err) {
		console.error("[Achievements] cache invalidation failed:", err)
	}
}

// Terminal reason + winner for reason-specific achievements.
export interface AchievementEndContext {
	endReason: string
	winnerId: bigint | null
}

// Award achievements to the game's human participants based on their
// win/draw counts in the `game_users` ledger (win: amount > 0, draw: amount = 0)
export async function evaluateAchievements(
	tx: Prisma.TransactionClient,
	gameId: string,
	context?: AchievementEndContext
): Promise<void> {
	const achievements = await getCachedAchievements()

	if (achievements.length === 0) {
		return
	}

	const idByName = new Map(achievements.map(row => [row.name, row.id]))

	const participants = await tx.gameUser.findMany({
		where: { game_id: gameId },
		select: {
			user_id: true,
			users: { select: { is_bot: true } }
		}
	})

	const awards: { user_id: bigint; achievement_id: bigint }[] = []

	for (const participant of participants) {
		// Bots don't collect achievements.
		if (participant.users.is_bot) {
			continue
		}

		const userId = participant.user_id

		const winCount = await tx.gameUser.count({
			where: { user_id: userId, amount: { gt: 0 } }
		})
		const drawCount = await tx.gameUser.count({
			where: { user_id: userId, amount: 0 }
		})

		const grant = (name: string) => {
			const achievementId = idByName.get(name)
			if (achievementId !== undefined) {
				awards.push({ user_id: userId, achievement_id: achievementId })
			}
		}

		// grant achievements based on game result
		if (winCount >= 1) {
			grant(ACHIEVEMENT_TITLE.FIRST_WIN)
		}
		if (winCount >= WIN_100_THRESHOLD) {
			grant(ACHIEVEMENT_TITLE.WIN_100)
		}
		if (drawCount >= DRAW_50_THRESHOLD) {
			grant(ACHIEVEMENT_TITLE.DRAW_50)
		}
		// Stalemate (困毙)
		if (context?.endReason === "stalemate" && context.winnerId != null && userId === context.winnerId) {
			grant(ACHIEVEMENT_TITLE.NO_LEGAL_MOVES)
		}
	}

	if (awards.length > 0) {
		await tx.userAchievement.createMany({
			data: awards,
			skipDuplicates: true
		})
	}
}
