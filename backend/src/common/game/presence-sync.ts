import prisma from "prisma"
import { getStatus } from "common/presence"
import { emitPresenceChanged } from "common/socket"

/**
 * Human (non-bot) player ids of a game.
 */
async function getHumanPlayerIds(gameId: string): Promise<number[]> {
	const gameUsers = await prisma.gameUser.findMany({
		where: { game_id: gameId, users: { is_bot: false } },
		select: { user_id: true }
	})
	return gameUsers.map(gu => Number(gu.user_id))
}

/**
 * Broadcast the presence of every human player of a game.
 * - `busy = true`  (game started): mark them "busy" (red badge).
 * - `busy = false` (game ended): re-broadcast their heartbeat-derived status
 *   (online / inactive / offline) so the busy badge clears.
 */
export async function syncPlayersPresence(gameId: string, busy: boolean) {
	try {
		const ids = await getHumanPlayerIds(gameId)
		for (const id of ids) {
			const status = busy ? "busy" : await getStatus(id)
			emitPresenceChanged(id, status)
		}
	} catch (error) {
		console.error(`[presence] syncPlayersPresence failed for game ${gameId}:`, error)
	}
}
