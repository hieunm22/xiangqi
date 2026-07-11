import prisma from "prisma"
import { runEndGameTransaction } from "common/game/end-game.helper"
import { activatePostGameLock } from "common/game/post-game.helper"
import { syncPlayersPresence } from "common/game/presence-sync"
import { getUTCTimestamp } from "common/helper"
import { getGameHistoryCollection } from "common/mongodb"
import { emitGameEnded } from "common/socket"
import { getVariant, otherTeam } from "common/variants"
import {
	ClockBaseline,
	ClockConfig,
	ClockHistoryRecord,
	ClockSnapshot,
	ClockState,
	Team
} from "types/game.type"

// The clock tracks two seats. One is always "black" (both xiangqi and chess have
// it); the other ("red" in xiangqi, "white" in chess) maps to the "red" slot. This
// keeps the persisted two-slot shape working for both variants.
type ClockSlot = "red" | "black"
const slotOf = (team: string): ClockSlot => (team === "black" ? "black" : "red")

// setTimeout truncates delays larger than a signed 32-bit int, which would fire
// almost immediately. Clamp scheduling below that. Real budgets are minutes, so
// this cap is only a safety net.
const MAX_TIMEOUT_DELAY_MS = 2_000_000_000

// In-memory per-game flag timers. A single timer per in-progress game fires when
// the team on the move runs out of time without moving. Rescheduled on every
// move; rehydrated on boot (see rehydrateClocks). Mirrors the in-memory timers
// already used for presence and the post-game lock - assumes a single backend
// instance; a horizontally-scaled deployment would move this to a Redis-backed
// delayed job.
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
			game_type: true,
			time_limit: true,
			time_increment: true,
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
		gameType: game.game_type,
		timeLimit: game.time_limit,
		timeIncrement: game.time_increment ?? 0,
		betAmount: game.room?.bet_amount ?? null,
		pveMode: game.room?.pve_mode ?? false,
		participants: game.game_users.map(gu => ({
			userId: Number(gu.user_id),
			team: (gu.team as Team | null) ?? null
		}))
	}
}

/**
 * Ordered move history (oldest first) reduced to the fields the clock needs.
 * The first record is the game-start marker; each subsequent record's timestamp
 * marks when the team named in the PREVIOUS record completed its move.
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
 * Time spent (ms) and completed moves per side, derived from the ordered
 * history. Honors resume anchors: computation starts from the LAST record that
 * carries a baseline (its accumulated totals), then adds only the gaps after it -
 * so the wall-clock time an undo removed is never charged to anyone.
 */
function deriveSpent(records: ClockHistoryRecord[]): {
	spentMs: Record<ClockSlot, number>
	completedMoves: Record<ClockSlot, number>
} {
	let anchorIdx = 0
	const spentMs: Record<ClockSlot, number> = { red: 0, black: 0 }
	const completedMoves: Record<ClockSlot, number> = { red: 0, black: 0 }

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
		const mover = slotOf(records[i - 1].team)
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
 * Pure clock math: derive each side's remaining time (ms) and the active team's
 * flag deadline from the move history. Returns null when the game has no time
 * limit or no history yet.
 */
export function computeClockState(
	records: ClockHistoryRecord[],
	config: Pick<ClockConfig, "timeLimit" | "timeIncrement">,
	nowMs: number
): ClockState | null {
	const { timeLimit } = config
	if (timeLimit == null || records.length === 0) {
		return null
	}

	const budgetMs = timeLimit * 1000
	const incrementMs = (config.timeIncrement ?? 0) * 1000
	const { spentMs, completedMoves } = deriveSpent(records)

	const last = records[records.length - 1]
	const activeTeam = last.team
	const activeSlot = slotOf(activeTeam)
	const turnStartMs = last.timeStamp * 1000
	const inProgressMs = Math.max(0, nowMs - turnStartMs)

	const remainingForSlot = (slot: ClockSlot): number => {
		const budget = budgetMs + completedMoves[slot] * incrementMs
		let remaining = budget - spentMs[slot]
		if (slot === activeSlot) {
			remaining -= inProgressMs
		}
		return Math.max(0, remaining)
	}

	const activeBudget = budgetMs + completedMoves[activeSlot] * incrementMs

	return {
		redMs: remainingForSlot("red"),
		blackMs: remainingForSlot("black"),
		activeTeam,
		deadlineMs: turnStartMs + activeBudget - spentMs[activeSlot],
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
		serverNow: state.serverNow,
		timeLimit: config.timeLimit,
		timeIncrement: config.timeIncrement
	}
}

/** Cancel and forget a game's flag timer. Safe to call for unknown games. */
export function stopClock(gameId: string): void {
	const timer = timers.get(gameId)
	if (timer) {
		clearTimeout(timer)
		timers.delete(gameId)
	}
}

/**
 * (Re)schedule the flag timer for a game based on its current history, and
 * return the resulting clock snapshot (null when the game is not clocked).
 * Call after the game starts and after every move.
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
		serverNow: state.serverNow,
		timeLimit: config.timeLimit,
		timeIncrement: config.timeIncrement
	}
}

/**
 * The active team's flag has (supposedly) fallen. Re-verify against the latest
 * state, then end the game: the opponent wins if they have crossing material,
 * otherwise it is a draw (vi.json result.paragraph4).
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

		const activeRemaining = slotOf(state.activeTeam) === "black" ? state.blackMs : state.redMs
		if (activeRemaining > 0) {
			await armClock(gameId)
			return
		}

		const variant = getVariant(config.gameType)
		const loserTeam = state.activeTeam
		const winnerTeam = otherTeam(variant, loserTeam) as Team
		const latestFen = records[records.length - 1].fen
		const winnerCanWin = variant.flagResolver(latestFen, winnerTeam)

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
			winner_id: winnerUserId
		})

		const ended = await runEndGameTransaction({
			gameId,
			roomId: config.roomId,
			winnerId: winnerUserId == null ? null : BigInt(winnerUserId),
			isBotGame: config.pveMode,
			betAmount: config.betAmount
		})

		if (ended) {
			await syncPlayersPresence(gameId, false)
			await activatePostGameLock(config.roomId, gameId)
			emitGameEnded(Number(config.roomId), {
				gameId,
				status: "timeout",
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
			where: { status: 1, time_limit: { not: null } },
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
