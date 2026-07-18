import prisma from "prisma"
import { getGameHistoryCollection } from "../mongodb"
import { emitGameEnded } from "../socket"
import { runEndGameTransaction } from "./end-game.helper"
import { stopClock } from "./game-clock"
import { activatePostGameLock } from "./post-game.helper"
import { syncPlayersPresence } from "./presence-sync"
import { GameEndReason, Team } from "types/game.type"

export interface ConcludeGameParams {
	gameId: string
	roomId: bigint
	winnerTeam: Team | null
	isBotGame: boolean
	betAmount: number | null
	statusForEvent: GameEndReason
}

export interface ConcludeGameResult {
	ended: boolean
	winnerId: number | null
}

// Settle a finished game and run the shared post-game side effects
export async function concludeGame(params: ConcludeGameParams): Promise<ConcludeGameResult> {
	const {
		gameId,
		roomId,
		winnerTeam,
		isBotGame,
		betAmount,
		statusForEvent
	} = params

	const roomUsers = await prisma.roomUser.findMany({
		where: { room_id: roomId },
		select: {
			team: true,
			user_id: true
		}
	})

	const winner = winnerTeam ? roomUsers.find(user => user.team === winnerTeam) : undefined
	const winnerId = winner ? Number(winner.user_id) : null

	const ended = await runEndGameTransaction({
		gameId,
		roomId,
		winnerId: winnerId == null ? null : BigInt(winnerId),
		isBotGame,
		betAmount,
		endReason: statusForEvent
	})

	if (!ended) {
		return { ended: false, winnerId }
	}

	stopClock(gameId)
	await syncPlayersPresence(gameId, false)
	await activatePostGameLock(roomId, gameId)

	const collection = await getGameHistoryCollection()
	const latestRecord = await collection
		.find({
			$or: [{ game_id: gameId }, { gameId }]
		})
		.sort({ _id: -1 })
		.limit(1)
		.toArray()

	if (latestRecord.length > 0) {
		await collection.updateOne(
			{ _id: latestRecord[0]._id },
			{ $set: { winner_id: winnerId, end_reason: statusForEvent } }
		)
	}

	emitGameEnded(Number(roomId), {
		gameId,
		status: statusForEvent,
		winnerId
	})

	return { ended: true, winnerId }
}
