import prisma from "prisma"
import { getUTCNow } from "../helper"
import { EndGameParams } from "types/game.type"

// Atomically end a game and settle points.
export async function runEndGameTransaction(params: EndGameParams): Promise<boolean> {
	const { gameId, roomId, winnerId, isBotGame, betAmount } = params

	return prisma.$transaction(async tx => {
		// Claim the game: only matches while it is still in progress (status != 2).
		const claimed = await tx.game.updateMany({
			where: { id: gameId, status: { not: 2 } },
			data: {
				ends_at: getUTCNow(),
				winner_id: winnerId,
				status: 2
			}
		})

		// Another request already ended this game — skip all point mutations.
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
				data: { point: isBotGame ? null : 0 }
			})
		}
		// Calculate points for PvP games only
		else if (!isBotGame && betAmount && betAmount > 0) {
			// Winner: set (not increment) the per-game point so it stays idempotent.
			await tx.gameUser.upsert({
				where: {
					game_id_user_id: {
						game_id: gameId,
						user_id: winnerId
					}
				},
				update: { point: betAmount },
				create: {
					game_id: gameId,
					user_id: winnerId,
					point: betAmount
				}
			})

			// Update winner's point in auth.users table
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
					data: { point: -betAmount }
				})

				// Update losers' points in auth.users table
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
}
