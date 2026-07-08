import type { Prisma } from "../../generated/prisma"
import { DRAW_50_THRESHOLD, WIN_100_THRESHOLD } from "./achievement.constant"
import { ACHIEVEMENT_TITLE } from "./achievement.constant"

// Award achievements to the game's human participants based on their
// win/draw counts in the `game_users` ledger (win: amount > 0, draw: amount = 0)
export async function evaluateAchievements(tx: Prisma.TransactionClient, gameId: string): Promise<void> {
	const achievements = await tx.achievement.findMany({
		select: { id: true, name: true }
	})

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
	}

	if (awards.length > 0) {
		await tx.userAchievement.createMany({
			data: awards,
			skipDuplicates: true
		})
	}
}
