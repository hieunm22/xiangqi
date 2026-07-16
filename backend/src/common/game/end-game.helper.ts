import prisma from "prisma"
import { evaluateAchievements } from "./achievement.helper"
import { getUTCNow } from "../helper"
import { EndGameParams } from "types/game.type"

// Atomically end a game and settle amounts.
export async function runEndGameTransaction(params: EndGameParams): Promise<boolean> {
	const {
		betAmount,
		endReason,
		gameId,
		isBotGame,
		roomId,
		winnerId,
	} = params

	const ended = await prisma.$transaction(async tx => {
		// Claim the game: only matches while it is still in progress (status != 2).
		const claimed = await tx.game.updateMany({
			where: { id: gameId, status: { not: 2 } },
			data: {
				ends_at: getUTCNow(),
				winner_id: winnerId,
				status: 2
			}
		})

		// Another request already ended this game — skip all amount mutations.
		if (claimed.count === 0) {
			return false
		}

		await tx.room.update({
			where: { id: roomId },
			data: {
				updated_at: getUTCNow(),
				status: 1
			}
		})

		// Draw: only update existing participants of this game
		if (winnerId === null) {
			await tx.gameUser.updateMany({
				where: { game_id: gameId },
				data: { amount: isBotGame ? null : 0 }
			})
		}
		// Calculate amounts for PvP games only
		else if (!isBotGame && betAmount && betAmount > 0) {
			// Winner: set (not increment) the per-game amount so it stays idempotent.
			await tx.gameUser.upsert({
				where: {
					game_id_user_id: {
						game_id: gameId,
						user_id: winnerId
					}
				},
				update: { amount: betAmount },
				create: {
					game_id: gameId,
					user_id: winnerId,
					amount: betAmount
				}
			})

			// Update winner's amount in auth.users table
			await tx.user.update({
				where: { id: winnerId },
				data: {
					total_amount: {
						increment: betAmount
					}
				}
			})

			// Get all game users to find the loser and update their points
			const gameUsers = await tx.gameUser.findMany({
				where: { game_id: gameId },
				select: { user_id: true }
			})

			const loserIds = gameUsers
				.map(gu => gu.user_id)
				.filter(uid => uid !== winnerId)

			if (loserIds.length > 0) {
				await tx.gameUser.updateMany({
					where: {
						game_id: gameId,
						user_id: { in: loserIds }
					},
					data: { amount: -betAmount }
				})

				// Update losers' amounts in auth.users table
				await tx.user.updateMany({
					where: { id: { in: loserIds } },
					data: {
						total_amount: {
							decrement: betAmount
						}
					}
				})
			}
		}

		return true
	})

	// Award achievements after the game result is committed
	if (ended) {
		try {
			await evaluateAchievements(prisma, gameId, {
				endReason,
				winnerId
			})
		} catch (err) {
			console.error(`[End-Game] achievement evaluation failed for game ${gameId}:`, err)
		}
	}

	return ended
}
