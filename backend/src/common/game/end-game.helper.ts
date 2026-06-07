import prisma from "prisma"
import { EndGameParams } from "types/game.type"

export async function buildEndGameTransaction(params: EndGameParams) {
	const { gameId, roomId, winnerId, isBotGame, betAmount } = params

	const updates: any[] = [
		prisma.game.update({
			where: { id: gameId },
			data: {
				ends_at: new Date(),
				winner_id: winnerId,
				status: 2
			}
		}),
		prisma.room.update({
			where: { id: roomId },
			data: {
				updated_at: new Date(),
				status: 1
			}
		})
	]

	// Calculate points for PvP games only
	if (!isBotGame && betAmount && betAmount > 0) {
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
		}
	}

	return updates
}
