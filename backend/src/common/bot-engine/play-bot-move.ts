import { getGameHistoryCollection } from "../mongodb"
import { emitMovePiece } from "../socket"
import { BOT_USER_ID, requestBotMove } from "./index"

export interface PlayBotMoveParams {
	gameId: string
	roomId: bigint | number
	projectFen: string
	redFirst: boolean
	botTeam: "red" | "black"
	difficulty: number
}

/**
 * Run one bot move end-to-end: ask the engine, persist the resulting position to
 * MongoDB game_history, and broadcast `piece-moved` to the room over Socket.IO.
 *
 * Mirrors the persistence side of `move-piece.ts` so a bot move is indistinguishable
 * from a human move to listening clients.
 *
 * Returns the inserted history record (or null on engine/network failure — the caller
 * decides whether to surface or swallow the error).
 */
export const playBotMove = async (params: PlayBotMoveParams): Promise<any | null> => {
	const { gameId, roomId, projectFen, redFirst, botTeam, difficulty } = params

	const { newFen, capturePiece } = await requestBotMove({
		gameId,
		projectFen,
		redFirst,
		botTeam,
		difficulty
	})

	const collection = await getGameHistoryCollection()

	const nextTeam = botTeam === "red" ? "black" : "red"
	const record: any = {
		game_id: gameId,
		fen: newFen,
		team: nextTeam,
		time_stamp: Math.floor(Date.now() / 1000)
	}
	if (capturePiece) {
		record.capture = capturePiece
	}

	const insertResult = await collection.insertOne(record)
	const broadcast = { ...record, _id: insertResult.insertedId.toString() }

	try {
		emitMovePiece(roomId.toString(), broadcast, Number(BOT_USER_ID))
	} catch (err) {
		console.error("[bot-engine] socket emit failed:", err)
	}

	return broadcast
}
