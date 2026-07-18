import prisma from "prisma"
import {
	hasAttackingMaterial,
	isSoldierAdvance,
	parseFenCounters,
	toStandardFen
} from "../board-helper"
import { NATURAL_MOVE_LIMIT_PLIES } from "../constant"
import { concludeGame } from "../game/conclude-game.helper"
import { evaluatePerpetualCheck, wouldCompletePerpetualLoss } from "../game/perpetual-check.helper"
import { evaluateTeamState } from "../game/state-evaluator"
import { getUTCNow, getUTCTimestamp } from "../helper"
import { getGameHistoryCollection } from "../mongodb"
import {
	emitMovePiece,
	emitPerpetualCheckWarning,
	emitSurrender
} from "../socket"
import { syncPlayersPresence } from "../game/presence-sync"
import { BOT_USER_ID, requestBotMove } from "./index"
import { Team } from "types/game.type"

export interface PlayBotMoveParams {
	gameId: string
	roomId: bigint | number
	projectFen: string
	redFirst: boolean
	botTeam: Team
	difficulty: number
}

/**
 * Run one bot move: ask engine, persist to MongoDB, broadcast `piece-moved` via Socket.IO.
 * Auto-surrenders if no legal moves; returns the inserted record or null on failure.
 */
export const playBotMove = async (params: PlayBotMoveParams): Promise<any | null> => {
	const { gameId, roomId, projectFen, redFirst, botTeam, difficulty } = params

	// The side to move after the bot — i.e. the human in a PvE game.
	const nextTeam: Team = botTeam === "red" ? "black" : "red"

	const result = await requestBotMove(
		{
			gameId,
			projectFen,
			redFirst,
			botTeam,
			difficulty
		},
		{
			// Avoid a perpetual check the bot would lose: reject a candidate that keeps
			// the human in check AND completes the losing repetition. Non-checks are fine.
			rejectMove: async candidate => {
				if (!evaluateTeamState(candidate.newFen, nextTeam, redFirst).inCheck) {
					return false
				}
				return wouldCompletePerpetualLoss(gameId, candidate.newFen, nextTeam, redFirst)
			}
		}
	)

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

			// Find the human opponent (winner) before writing the terminal record.
			const roomUsers = await prisma.roomUser.findMany({
				where: { room_id: BigInt(roomId) },
				select: { user_id: true, team: true }
			})
			const winnerTeam = botTeam === "red" ? "black" : "red"
			const winner = roomUsers.find(u => u.team === winnerTeam)

			await collection.insertOne({
				game_id: gameId,
				fen: currentFen,
				team: winnerTeam,
				time_stamp: getUTCTimestamp(),
				surrender_id: Number(BOT_USER_ID),
				winner_id: winner ? Number(winner.user_id) : null,
				end_reason: "surrender"
			})

			if (winner) {
				await prisma.$transaction([
					prisma.game.update({
						where: { id: gameId },
						data: { ends_at: getUTCNow(), winner_id: winner.user_id, status: 2 }
					}),
					prisma.room.update({
						where: { id: BigInt(roomId) },
						data: { updated_at: getUTCNow(), status: 1 }
					})
				])
			}

			// Bot lost — game over, clear the human player's "busy" presence.
			await syncPlayersPresence(gameId, false)

			emitSurrender(roomId.toString(), gameId, Number(BOT_USER_ID))
		} catch (err) {
			console.error(`[bot-engine] bot surrender failed for game ${gameId}:`, err)
		}

		return null
	}

	const { newFen, capturePiece } = result

	const collection = await getGameHistoryCollection()

	// Persist the standard 6-field FEN, mirroring move-piece: advance counters from
	// the latest record (half-move resets on a capture, full-move bumps after black).
	const latest = await collection.find({ game_id: gameId }).sort({ _id: -1 }).limit(1).toArray()
	const prevFen = latest[0]?.fen as string | undefined
	const prevCounters = parseFenCounters(prevFen ?? "")
	// No-progress clock resets on a capture or a forward soldier advance (draw rule).
	const madeProgress =
		Boolean(capturePiece) || (prevFen ? isSoldierAdvance(prevFen, newFen, botTeam) : false)
	const halfmove = madeProgress ? 0 : prevCounters.halfmove + 1
	const fullmove = botTeam === "black" ? prevCounters.fullmove + 1 : prevCounters.fullmove
	const standardFen = toStandardFen(newFen, nextTeam, halfmove, fullmove)

	const record: any = {
		game_id: gameId,
		fen: standardFen,
		team: nextTeam,
		time_stamp: getUTCTimestamp()
	}
	if (capturePiece) {
		record.capture = capturePiece
	}

	const insertResult = await collection.insertOne(record)
	const broadcast = { ...record, _id: insertResult.insertedId.toString() }

	try {
		emitMovePiece(Number(roomId), broadcast, Number(BOT_USER_ID))
	} catch (err) {
		console.error("[bot-engine] socket emit failed:", err)
	}

	// Evaluate the human side right after the bot move. This makes bot-delivered
	// checkmate/stalemate end the game immediately
	const humanTeam = nextTeam
	const humanEvaluation = evaluateTeamState(newFen, humanTeam, redFirst)
	if (humanEvaluation.status === "checkmate" || humanEvaluation.status === "stalemate") {
		try {
			const room = await prisma.room.findUnique({
				where: { id: BigInt(roomId) },
				select: { pve_mode: true, bet_amount: true }
			})
			await concludeGame({
				gameId,
				roomId: BigInt(roomId),
				winnerTeam: botTeam,
				isBotGame: room?.pve_mode ?? true,
				betAmount: room?.bet_amount ?? null,
				statusForEvent: humanEvaluation.status
			})
		} catch (err) {
			console.error(`[bot-engine] failed to conclude ${humanEvaluation.status} for game ${gameId}:`, err)
		}

		return broadcast
	}

	// Dead draw: neither side has any attacking piece left.
	if (!hasAttackingMaterial(newFen, "red") && !hasAttackingMaterial(newFen, "black")) {
		try {
			const room = await prisma.room.findUnique({
				where: { id: BigInt(roomId) },
				select: { pve_mode: true, bet_amount: true }
			})
			await concludeGame({
				gameId,
				roomId: BigInt(roomId),
				winnerTeam: null,
				isBotGame: room?.pve_mode ?? true,
				betAmount: room?.bet_amount ?? null,
				statusForEvent: "draw"
			})
		} catch (err) {
			console.error(`[bot-engine] failed to conclude draw for game ${gameId}:`, err)
		}

		return broadcast
	}

	// Natural move-limit: too many plies with no capture and no forward soldier advance.
	if (halfmove >= NATURAL_MOVE_LIMIT_PLIES) {
		try {
			const room = await prisma.room.findUnique({
				where: { id: BigInt(roomId) },
				select: { pve_mode: true, bet_amount: true }
			})
			await concludeGame({
				gameId,
				roomId: BigInt(roomId),
				winnerTeam: null,
				isBotGame: room?.pve_mode ?? true,
				betAmount: room?.bet_amount ?? null,
				statusForEvent: "draw"
			})
		} catch (err) {
			console.error(`[bot-engine] failed to conclude natural-limit draw for game ${gameId}:`, err)
		}

		return broadcast
	}

	// Safety net: if avoidance couldn't prevent it (forced) and the bot's move still
	// completes a perpetual check, the bot (checker) loses; warn on the near-miss.
	try {
		if (evaluateTeamState(newFen, humanTeam, redFirst).inCheck) {
			const perpetual = await evaluatePerpetualCheck(gameId, newFen, humanTeam, redFirst)
			if (perpetual.status === "loss") {
				const room = await prisma.room.findUnique({
					where: { id: BigInt(roomId) },
					select: { pve_mode: true, bet_amount: true }
				})
				await concludeGame({
					gameId,
					roomId: BigInt(roomId),
					winnerTeam: humanTeam,
					isBotGame: room?.pve_mode ?? true,
					betAmount: room?.bet_amount ?? null,
					statusForEvent: "perpetual-check"
				})
			} else if (perpetual.status === "warning") {
				emitPerpetualCheckWarning(Number(roomId), { gameId, offenderTeam: botTeam, checkedTeam: humanTeam })
			}
		}
	} catch (err) {
		console.error(`[bot-engine] perpetual-check detection failed for game ${gameId}:`, err)
	}

	return broadcast
}
