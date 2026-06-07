import { getGameHistoryCollection } from "../mongodb"
import prisma from "prisma"
import { emitMovePiece, emitSurrender } from "../socket"
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
 * If the engine has no legal moves (bot is checkmated), the bot automatically
 * surrenders: persists a surrender record, updates game/room status, and emits a
 * `surrender` event to the room.
 *
 * Returns the inserted history record (or null on engine/network failure — the caller
 * decides whether to surface or swallow the error).
 */
export const playBotMove = async (params: PlayBotMoveParams): Promise<any | null> => {
	const { gameId, roomId, projectFen, redFirst, botTeam, difficulty } = params

	const result = await requestBotMove({
		gameId,
		projectFen,
		redFirst,
		botTeam,
		difficulty
	})

	// Bot has no legal moves — it is checkmated; auto-surrender on behalf of the bot
	if (result === null) {
		console.log(`[bot-engine] No legal moves for bot in game ${gameId} — bot surrenders`)

		try {
			const collection = await getGameHistoryCollection()

			// Get the latest FEN to preserve board state in the surrender record
			const latestRecords = await collection
				.find({ game_id: gameId })
				.sort({ _id: -1 })
				.limit(1)
				.toArray()

			const currentFen = latestRecords[0]?.fen ?? projectFen

			await collection.insertOne({
				game_id: gameId,
				fen: currentFen,
				team: botTeam === "red" ? "black" : "red",
				time_stamp: Math.floor(Date.now() / 1000),
				surrender: Number(BOT_USER_ID)
			})

			// Also save to PostgreSQL for test data
			await prisma.gameHistory.create({
				data: {
					game_id: gameId,
					fen: currentFen,
					team: botTeam === "red" ? "black" : "red",
					capture: null,
					time_stamp: Math.floor(Date.now() / 1000),
					surrender_id: BOT_USER_ID
				}
			})

			// Find the human opponent (winner)
			const roomUsers = await prisma.roomUser.findMany({
				where: { room_id: BigInt(roomId) },
				select: { user_id: true, team: true }
			})
			const winnerTeam = botTeam === "red" ? "black" : "red"
			const winner = roomUsers.find(u => u.team === winnerTeam)

			if (winner) {
				await prisma.$transaction([
					prisma.game.update({
						where: { id: gameId },
						data: { ends_at: new Date(), winner_id: winner.user_id, status: 2 }
					}),
					prisma.room.update({
						where: { id: BigInt(roomId) },
						data: { updated_at: new Date(), status: 1 }
					})
				])
			}

			emitSurrender(roomId.toString(), gameId, Number(BOT_USER_ID))
		} catch (err) {
			console.error(`[bot-engine] bot surrender failed for game ${gameId}:`, err)
		}

		return null
	}

	const { newFen, capturePiece } = result

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

	// Also save to PostgreSQL for test data
	await prisma.gameHistory.create({
		data: {
			game_id: gameId,
			fen: newFen,
			team: nextTeam,
			capture: capturePiece || null,
			time_stamp: Math.floor(Date.now() / 1000)
		}
	})

	try {
		emitMovePiece(Number(roomId), broadcast, Number(BOT_USER_ID))
	} catch (err) {
		console.error("[bot-engine] socket emit failed:", err)
	}

	return broadcast
}
