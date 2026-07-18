import prisma from "prisma"
import { hasPieceAcrossRiver } from "common/board-helper"
import { runEndGameTransaction } from "common/game/end-game.helper"
import { activatePostGameLock } from "common/game/post-game.helper"
import { syncPlayersPresence } from "common/game/presence-sync"
import { getUTCTimestamp } from "common/helper"
import { getGameHistoryCollection } from "common/mongodb"
import { emitGameEnded } from "common/socket"
import {
	ClockBaseline,
	ClockConfig,
	ClockHistoryRecord,
	ClockSnapshot,
	ClockState,
	Team
} from "types/game.type"

// setTimeout truncates delays > signed 32-bit int (fires almost immediately).
// Clamp scheduling below that; real game budgets are minutes so this is a safety net.
const MAX_TIMEOUT_DELAY_MS = 2_000_000_000

// In-memory per-game flag timers; one per game, rescheduled on every move and rehydrated on boot.
// Assumes a single backend instance - a scaled deployment would use a Redis-backed delayed job.
const timers = new Map<string, NodeJS.Timeout>()

/**
 * Load the per-game clock configuration and the participants needed to settle a
 * time-out. Returns null when the game does not exist.
 */
async function fetchConfig(gameId: string): Promise<ClockConfig | null> {
	const game = await prisma.game.findUnique({
		where: { id: gameId },
		select: {
			status: true,
			room_id: true,
			time_limit: true,
			time_increment: true,
			time_per_move: true,
			room: { select: { bet_amount: true, pve_mode: true } },
			game_users: { select: { user_id: true, team: true } }
		}
	})

	if (!game) {
		return null
	}

	return {
		status: game.status,
		roomId: game.room_id,
		timeLimit: game.time_limit,
		timeIncrement: game.time_increment ?? 0,
		timePerMove: game.time_per_move ?? 0,
		betAmount: game.room?.bet_amount ?? null,
		pveMode: game.room?.pve_mode ?? false,
		participants: game.game_users.map(gu => ({
			userId: Number(gu.user_id),
			team: (gu.team as Team | null) ?? null
		}))
	}
}

/**
 * Ordered move history (oldest first) reduced to clock-relevant fields.
 * First record is game-start; each subsequent timestamp marks the previous mover's completion.
 */
async function fetchHistory(gameId: string): Promise<ClockHistoryRecord[]> {
	const collection = await getGameHistoryCollection()
	const records = await collection
		.find({ $or: [{ game_id: gameId }, { gameId }] })
		.sort({ _id: 1 })
		.toArray()

	return records.map(record => ({
		team: record.team as Team,
		timeStamp: Number(record.time_stamp),
		fen: record.fen as string,
		baseline: (record.clock_baseline as ClockBaseline | undefined) ?? null
	}))
}

/**
 * Time spent (ms) and moves completed per side, derived from history.
 * Starts from the last baseline anchor so undone wall-clock time is never re-charged.
 */
function deriveSpent(records: ClockHistoryRecord[]): {
	spentMs: Record<Team, number>
	completedMoves: Record<Team, number>
} {
	let anchorIdx = 0
	const spentMs: Record<Team, number> = { red: 0, black: 0 }
	const completedMoves: Record<Team, number> = { red: 0, black: 0 }

	for (let i = records.length - 1; i >= 0; i -= 1) {
		const baseline = records[i].baseline
		if (baseline) {
			anchorIdx = i
			spentMs.red = baseline.spentMs.red
			spentMs.black = baseline.spentMs.black
			completedMoves.red = baseline.moves.red
			completedMoves.black = baseline.moves.black
			break
		}
	}

	for (let i = anchorIdx + 1; i < records.length; i += 1) {
		const mover = records[i - 1].team
		spentMs[mover] += Math.max(0, (records[i].timeStamp - records[i - 1].timeStamp) * 1000)
		completedMoves[mover] += 1
	}

	return { spentMs, completedMoves }
}

/**
 * Baseline to stamp onto the record an undo rewinds to. Captures time already
 * spent (using original timestamps) so the resumed turn starts fresh from now.
 */
export function computeUndoBaseline(records: ClockHistoryRecord[]): ClockBaseline {
	const { spentMs, completedMoves } = deriveSpent(records)
	return { spentMs, moves: completedMoves }
}

/**
 * Derive each side's remaining time (ms) and the active team's flag deadline.
 * Returns null when no time limit or no history.
 */
export function computeClockState(
	records: ClockHistoryRecord[],
	config: Pick<ClockConfig, "timeLimit" | "timeIncrement"> &
		Partial<Pick<ClockConfig, "timePerMove">>,
	nowMs: number
): ClockState | null {
	const { timeLimit } = config
	// A null, zero, or negative limit means the game is unlimited (no clock).
	if (timeLimit == null || timeLimit <= 0 || records.length === 0) {
		return null
	}

	const budgetMs = timeLimit * 1000
	const incrementMs = (config.timeIncrement ?? 0) * 1000
	const perMoveMs = Math.max(0, config.timePerMove ?? 0) * 1000
	const { spentMs, completedMoves } = deriveSpent(records)

	const last = records[records.length - 1]
	const activeTeam = last.team
	const turnStartMs = last.timeStamp * 1000
	const inProgressMs = Math.max(0, nowMs - turnStartMs)

	const remainingMs = (team: Team): number => {
		const budget = budgetMs + completedMoves[team] * incrementMs
		let remaining = budget - spentMs[team]
		if (team === activeTeam) {
			remaining -= inProgressMs
		}
		return Math.max(0, remaining)
	}

	const activeBudget = budgetMs + completedMoves[activeTeam] * incrementMs
	const totalDeadlineMs = turnStartMs + activeBudget - spentMs[activeTeam]
	const perMoveDeadlineMs = perMoveMs > 0 ? turnStartMs + perMoveMs : Infinity
	const deadlineMs = Math.min(totalDeadlineMs, perMoveDeadlineMs)

	return {
		redMs: remainingMs("red"),
		blackMs: remainingMs("black"),
		activeTeam,
		perMoveRemainingMs: perMoveMs > 0 ? Math.max(0, perMoveMs - inProgressMs) : 0,
		deadlineMs,
		perMoveBinding: perMoveDeadlineMs < totalDeadlineMs,
		serverNow: nowMs
	}
}

/**
 * Read-only clock snapshot for a game, for broadcasting or loading state.
 * Returns null when the game is not clocked.
 */
export async function computeClock(gameId: string): Promise<ClockSnapshot | null> {
	const config = await fetchConfig(gameId)
	if (!config || config.timeLimit == null) {
		return null
	}

	const state = computeClockState(await fetchHistory(gameId), config, Date.now())
	if (!state) {
		return null
	}

	return {
		redMs: state.redMs,
		blackMs: state.blackMs,
		activeTeam: state.activeTeam,
		perMoveRemainingMs: state.perMoveRemainingMs,
		serverNow: state.serverNow,
		timeLimit: config.timeLimit,
		timeIncrement: config.timeIncrement,
		timePerMove: config.timePerMove
	}
}

/**
 * Cancel and forget a game's flag timer. Safe to call for unknown games.
 */
export function stopClock(gameId: string): void {
	const timer = timers.get(gameId)
	if (timer) {
		clearTimeout(timer)
		timers.delete(gameId)
	}
}

/**
 * (Re)schedule the flag timer from current history; returns the clock snapshot.
 * Call after game starts and after every move. Null if game is unclocked.
 */
export async function armClock(gameId: string): Promise<ClockSnapshot | null> {
	const config = await fetchConfig(gameId)
	if (!config || config.timeLimit == null || config.status === 2) {
		stopClock(gameId)
		return null
	}

	const state = computeClockState(await fetchHistory(gameId), config, Date.now())
	if (!state) {
		stopClock(gameId)
		return null
	}

	stopClock(gameId)
	const delay = Math.max(0, Math.min(state.deadlineMs - Date.now(), MAX_TIMEOUT_DELAY_MS))
	const activeTeam = state.activeTeam
	const timer = setTimeout(() => {
		void handleFlag(gameId, activeTeam)
	}, delay)
	timer.unref?.()
	timers.set(gameId, timer)

	return {
		redMs: state.redMs,
		blackMs: state.blackMs,
		activeTeam: state.activeTeam,
		perMoveRemainingMs: state.perMoveRemainingMs,
		serverNow: state.serverNow,
		timeLimit: config.timeLimit,
		timeIncrement: config.timeIncrement,
		timePerMove: config.timePerMove
	}
}

/**
 * Handle a flag fall: re-verify, then end the game.
 * - Per-move timeout: an unconditional loss - the opponent always wins.
 * - Whole-game timeout: opponent wins only with crossing
 *   material, otherwise draw
 */
async function handleFlag(gameId: string, expectedTeam: Team): Promise<void> {
	timers.delete(gameId)

	try {
		const config = await fetchConfig(gameId)
		if (!config || config.timeLimit == null || config.status === 2) {
			return
		}

		const records = await fetchHistory(gameId)
		const state = computeClockState(records, config, Date.now())
		if (!state) {
			return
		}

		// The turn changed since scheduling (a move landed just in time): reschedule
		// for whoever is on the move now and bail.
		if (state.activeTeam !== expectedTeam) {
			await armClock(gameId)
			return
		}

				// Flag only once the effective deadline has arrived (±250ms tolerance for jitter).
				// If real time remains, reschedule and bail.
		if (state.deadlineMs - Date.now() > 250) {
			await armClock(gameId)
			return
		}

		const loserTeam = state.activeTeam
		const winnerTeam: Team = loserTeam === "red" ? "black" : "red"
		const latestFen = records[records.length - 1].fen

		const endReason = state.perMoveBinding ? "per-move-timeout" : "timeout"

		// Per-move timeout is an unconditional loss; whole-game timeout only wins with
		// crossing material, else draw.
		const winnerCanWin = state.perMoveBinding || hasPieceAcrossRiver(latestFen, winnerTeam)

		const findUser = (team: Team) =>
			config.participants.find(p => p.team === team)?.userId ?? null
		const loserUserId = findUser(loserTeam)
		// No crossing material -> draw, so there is no winner to credit.
		const winnerUserId = winnerCanWin ? findUser(winnerTeam) : null

		const collection = await getGameHistoryCollection()
		await collection.insertOne({
			game_id: gameId,
			fen: latestFen,
			team: winnerTeam,
			time_stamp: getUTCTimestamp(),
			timeout: loserUserId,
			winner_id: winnerUserId,
			end_reason: endReason
		})

		const ended = await runEndGameTransaction({
			gameId,
			roomId: config.roomId,
			winnerId: winnerUserId == null ? null : BigInt(winnerUserId),
			isBotGame: config.pveMode,
			betAmount: config.betAmount,
			endReason
		})

		if (ended) {
			await syncPlayersPresence(gameId, false)
			await activatePostGameLock(config.roomId, gameId)
			emitGameEnded(Number(config.roomId), {
				gameId,
				status: endReason,
				winnerId: winnerUserId,
				loserId: loserUserId,
				isDraw: winnerUserId == null
			})
		}
	} catch (err) {
		console.error(`[Game-Clock] flag handling failed for game ${gameId}:`, err)
	}
}

/**
 * Re-arm flag timers for every in-progress, clocked game after a server restart.
 * Games already past their deadline flag immediately.
 */
export async function rehydrateClocks(): Promise<void> {
	try {
		const games = await prisma.game.findMany({
			where: { status: 1, time_limit: { gt: 0 } },
			select: { id: true }
		})

		for (const game of games) {
			await armClock(game.id)
		}

		if (games.length > 0) {
			console.log(`[Game-Clock] rehydrated ${games.length} in-progress game clock(s)`)
		}
	} catch (err) {
		console.error("[Game-Clock] rehydrate failed:", err)
	}
}
