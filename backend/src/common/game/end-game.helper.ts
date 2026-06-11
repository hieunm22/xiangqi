import prisma from "prisma"
import { getUTCNow } from "../helper"
import { EndGameParams } from "types/game.type"

export async function buildEndGameTransaction(params: EndGameParams) {
	const { gameId, roomId, winnerId, isBotGame, betAmount } = params

	const updates: any[] = [
		prisma.game.update({
			where: { id: gameId },
			data: {
				ends_at: getUTCNow(),
				winner_id: winnerId,
				status: 2
			}
		}),
		prisma.room.update({
			where: { id: roomId },
			data: {
				updated_at: getUTCNow(),
				status: 1
			}
		})
	]

	// Draw: only update existing participants of this game
	if (winnerId === null) {
		updates.push(
			prisma.gameUser.updateMany({
				where: { game_id: gameId },
				data: { point: isBotGame ? null : 0 }
			})
		)
	}
	// Calculate points for PvP games only
	else if (!isBotGame && betAmount && betAmount > 0) {
		const gameUsersUpdate = prisma.gameUser.upsert({
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
		updates.push(gameUsersUpdate)

		// Update winner's point in auth.users table
		const winnerPointUpdate = prisma.user.update({
			where: { id: winnerId },
			data: {
				total_points: {
					increment: betAmount
				}
			}
		})
		updates.push(winnerPointUpdate)

		// Get all game users to find the loser and update their points
		const gameUsers = await prisma.gameUser.findMany({
			where: { game_id: gameId },
			select: { user_id: true }
		})

		const loserIds = gameUsers
			.map(gu => gu.user_id)
			.filter(uid => uid !== winnerId)

		if (loserIds.length > 0) {
			const gameUsersLoserUpdate = prisma.gameUser.updateMany({
				where: {
					game_id: gameId,
					user_id: { in: loserIds }
				},
				data: { point: -betAmount }
			})
			updates.push(gameUsersLoserUpdate)

			// Update losers' points in auth.users table
			const losersPointUpdate = prisma.user.updateMany({
				where: { id: { in: loserIds } },
				data: {
					total_points: {
						decrement: betAmount
					}
				}
			})
			updates.push(losersPointUpdate)
		}
	}

	return updates
}

