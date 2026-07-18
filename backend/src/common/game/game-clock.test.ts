import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ClockHistoryRecord } from "types/game.type"

const {
	gameFindUniqueMock,
	gameFindManyMock,
	historyToArrayMock,
	historyInsertOneMock,
	getGameHistoryCollectionMock,
	runEndGameTransactionMock,
	activatePostGameLockMock,
	syncPlayersPresenceMock,
	emitGameEndedMock
} = vi.hoisted(() => ({
	gameFindUniqueMock: vi.fn(),
	gameFindManyMock: vi.fn(),
	historyToArrayMock: vi.fn(),
	historyInsertOneMock: vi.fn(),
	getGameHistoryCollectionMock: vi.fn(),
	runEndGameTransactionMock: vi.fn(),
	activatePostGameLockMock: vi.fn(),
	syncPlayersPresenceMock: vi.fn(),
	emitGameEndedMock: vi.fn()
}))

vi.mock("prisma", () => ({
	default: {
		game: {
			findUnique: gameFindUniqueMock,
			findMany: gameFindManyMock
		}
	}
}))

vi.mock("common/mongodb", () => ({
	getGameHistoryCollection: getGameHistoryCollectionMock
}))

vi.mock("common/game/end-game.helper", () => ({
	runEndGameTransaction: runEndGameTransactionMock
}))

vi.mock("common/game/post-game.helper", () => ({
	activatePostGameLock: activatePostGameLockMock
}))

vi.mock("common/game/presence-sync", () => ({
	syncPlayersPresence: syncPlayersPresenceMock
}))

vi.mock("common/socket", () => ({
	emitGameEnded: emitGameEndedMock
}))

import { armClock, computeClockState, computeUndoBaseline, stopClock } from "./game-clock"

const BASE_MS = 1_700_000_000_000
const T0 = Math.floor(BASE_MS / 1000)
const GAME_ID = "game-uuid-1"

const setHistory = (records: Array<{ team: string; time_stamp: number; fen: string }>) => {
	historyToArrayMock.mockResolvedValue(records)
	getGameHistoryCollectionMock.mockResolvedValue({
		find: () => ({ sort: () => ({ toArray: historyToArrayMock }) }),
		insertOne: historyInsertOneMock
	})
}

const setConfig = (overrides: Record<string, unknown> = {}) => {
	gameFindUniqueMock.mockResolvedValue({
		status: 1,
		room_id: BigInt(101),
		time_limit: 60,
		time_increment: 0,
		time_per_move: 0,
		room: { bet_amount: 50, pve_mode: false },
		game_users: [
			{ user_id: BigInt(11), team: "red" },
			{ user_id: BigInt(12), team: "black" }
		],
		...overrides
	})
}

describe("computeClockState", () => {
	it("returns null when there is no time limit", () => {
		const records: ClockHistoryRecord[] = [{ team: "red", timeStamp: T0, fen: "x" }]
		expect(
			computeClockState(records, { timeLimit: null, timeIncrement: 0 }, BASE_MS)
		).toBeNull()
	})

	it("returns null when there is no history", () => {
		expect(computeClockState([], { timeLimit: 60, timeIncrement: 0 }, BASE_MS)).toBeNull()
	})

	it("treats a zero (or negative) time limit as unlimited, not an instant flag", () => {
		const records: ClockHistoryRecord[] = [{ team: "red", timeStamp: T0, fen: "x" }]
		expect(computeClockState(records, { timeLimit: 0, timeIncrement: 0 }, BASE_MS)).toBeNull()
		expect(computeClockState(records, { timeLimit: -5, timeIncrement: 0 }, BASE_MS)).toBeNull()
	})

	it("exposes the active team's per-move remaining and caps the deadline by it", () => {
		const records: ClockHistoryRecord[] = [{ team: "red", timeStamp: T0, fen: "x" }]
		// 15min total, 60s per move: 20s into the move -> 40s left on the move cap,
		// and the flag deadline is the per-move cap (T0+60s), not the far-off total.
		const state = computeClockState(
			records,
			{ timeLimit: 900, timeIncrement: 0, timePerMove: 60 },
			(T0 + 20) * 1000
		)

		expect(state?.perMoveRemainingMs).toBe(40_000)
		expect(state?.redMs).toBe(880_000) // total still counts down independently
		expect(state?.deadlineMs).toBe(T0 * 1000 + 60_000) // capped by per-move
		expect(state?.perMoveBinding).toBe(true) // per-move cap is the binding deadline
	})

	it("keeps the total-time deadline when it is sooner than the per-move cap", () => {
		// Only 5s of total left but a 60s per-move cap -> total wins the deadline.
		const records: ClockHistoryRecord[] = [{ team: "red", timeStamp: T0, fen: "x" }]
		const state = computeClockState(
			records,
			{ timeLimit: 5, timeIncrement: 0, timePerMove: 60 },
			(T0 + 1) * 1000
		)
		expect(state?.deadlineMs).toBe(T0 * 1000 + 5_000)
		expect(state?.perMoveRemainingMs).toBe(59_000)
		expect(state?.perMoveBinding).toBe(false) // whole-game budget binds, not per-move
	})

	it("counts down the active team's clock from the last move timestamp", () => {
		const records: ClockHistoryRecord[] = [{ team: "red", timeStamp: T0, fen: "x" }]
		const state = computeClockState(
			records,
			{ timeLimit: 60, timeIncrement: 0 },
			BASE_MS + 10_000
		)

		expect(state).not.toBeNull()
		expect(state?.activeTeam).toBe("red")
		expect(state?.redMs).toBe(50_000) // 60s budget - 10s elapsed this turn
		expect(state?.blackMs).toBe(60_000) // black has not started ticking
		expect(state?.deadlineMs).toBe(T0 * 1000 + 60_000)
	})

	it("charges each completed move to the team that made it", () => {
		// red moved after 15s (t0->t0+15), black now on the move for 5s.
		const records: ClockHistoryRecord[] = [
			{ team: "red", timeStamp: T0, fen: "x" },
			{ team: "black", timeStamp: T0 + 15, fen: "y" }
		]
		const state = computeClockState(
			records,
			{ timeLimit: 60, timeIncrement: 0 },
			(T0 + 20) * 1000
		)

		expect(state?.activeTeam).toBe("black")
		expect(state?.redMs).toBe(45_000) // 60s - 15s spent
		expect(state?.blackMs).toBe(55_000) // 60s - 5s elapsed this turn
	})

	it("adds Fischer increment for each completed move", () => {
		const records: ClockHistoryRecord[] = [
			{ team: "red", timeStamp: T0, fen: "x" },
			{ team: "black", timeStamp: T0 + 10, fen: "y" }
		]
		// red: 60s - 10s + 1 move * 5s increment = 55s
		const state = computeClockState(
			records,
			{ timeLimit: 60, timeIncrement: 5 },
			(T0 + 10) * 1000
		)
		expect(state?.redMs).toBe(55_000)
	})

	it("resumes from a baseline anchor without charging the removed (undo) pause", () => {
		// Post-undo: a single resume record stamped with red having spent 15s / 1 move.
		// `now` is 5s after the resume timestamp — the long gap before it is NOT charged.
		const records: ClockHistoryRecord[] = [
			{
				team: "red",
				timeStamp: T0,
				fen: "x",
				baseline: { spentMs: { red: 15_000, black: 0 }, moves: { red: 1, black: 0 } }
			}
		]
		const state = computeClockState(
			records,
			{ timeLimit: 60, timeIncrement: 0 },
			(T0 + 5) * 1000
		)

		expect(state?.activeTeam).toBe("red")
		expect(state?.redMs).toBe(40_000) // 60 - 15 baseline - 5 in-progress
		expect(state?.blackMs).toBe(60_000) // black untouched
	})

	it("adds only post-anchor gaps on top of the baseline", () => {
		const records: ClockHistoryRecord[] = [
			{
				team: "red",
				timeStamp: T0,
				fen: "x",
				baseline: { spentMs: { red: 15_000, black: 0 }, moves: { red: 1, black: 0 } }
			},
			{ team: "black", timeStamp: T0 + 8, fen: "y" } // red spent 8s after resuming
		]
		const state = computeClockState(
			records,
			{ timeLimit: 60, timeIncrement: 0 },
			(T0 + 11) * 1000
		)

		expect(state?.activeTeam).toBe("black")
		expect(state?.redMs).toBe(37_000) // 60 - (15 baseline + 8) = 37
		expect(state?.blackMs).toBe(57_000) // 60 - 3 in-progress
	})
})

describe("computeUndoBaseline", () => {
	it("captures spent time and move counts from the remaining history", () => {
		const remaining: ClockHistoryRecord[] = [
			{ team: "red", timeStamp: T0, fen: "x" },
			{ team: "black", timeStamp: T0 + 15, fen: "y" }
		]
		expect(computeUndoBaseline(remaining)).toEqual({
			spentMs: { red: 15_000, black: 0 },
			moves: { red: 1, black: 0 }
		})
	})

	it("composes on top of an existing baseline anchor", () => {
		const remaining: ClockHistoryRecord[] = [
			{
				team: "red",
				timeStamp: T0,
				fen: "x",
				baseline: { spentMs: { red: 15_000, black: 0 }, moves: { red: 1, black: 0 } }
			},
			{ team: "black", timeStamp: T0 + 8, fen: "y" }
		]
		expect(computeUndoBaseline(remaining)).toEqual({
			spentMs: { red: 23_000, black: 0 },
			moves: { red: 2, black: 0 }
		})
	})
})

describe("game-clock flag timer", () => {
	beforeEach(() => {
		vi.useFakeTimers()
		vi.setSystemTime(BASE_MS)
		runEndGameTransactionMock.mockResolvedValue(true)
		historyInsertOneMock.mockResolvedValue({ insertedId: "m1" })
	})

	afterEach(() => {
		stopClock(GAME_ID)
		vi.clearAllMocks()
		vi.useRealTimers()
	})

	it("does not schedule a timer for an unclocked game", async () => {
		setConfig({ time_limit: null })
		setHistory([{ team: "red", time_stamp: T0, fen: "x" }])

		const snapshot = await armClock(GAME_ID)
		expect(snapshot).toBeNull()
	})

	it("does not flag a zero-limit game (treated as unlimited, no instant draw)", async () => {
		setConfig({ time_limit: 0 })
		setHistory([{ team: "red", time_stamp: T0, fen: "4G4/9/9/9/9/9/9/9/9/4g4" }])

		const snapshot = await armClock(GAME_ID)
		expect(snapshot).toBeNull()

		await vi.advanceTimersByTimeAsync(60_000)
		expect(runEndGameTransactionMock).not.toHaveBeenCalled()
		expect(emitGameEndedMock).not.toHaveBeenCalled()
	})

	it("treats a per-move flag as an unconditional loss, even without crossing material", async () => {
		// 15min total but only 30s per move; red sits -> flags at 30s on the per-move cap.
		// Red has no crossing material, but a per-move timeout is an unconditional loss:
		// black wins outright, NOT the river-crossing draw.
		setConfig({ time_limit: 900, time_per_move: 30 })
		setHistory([{ team: "red", time_stamp: T0, fen: "4G4/9/9/9/9/9/9/9/9/4g4" }])

		const snapshot = await armClock(GAME_ID)
		expect(snapshot).toMatchObject({
			activeTeam: "red",
			perMoveRemainingMs: 30_000,
			timePerMove: 30,
			redMs: 900_000
		})

		await vi.advanceTimersByTimeAsync(30_000)
		expect(runEndGameTransactionMock).toHaveBeenCalledWith(
			expect.objectContaining({ gameId: GAME_ID, winnerId: BigInt(12), endReason: "per-move-timeout" })
		)
		expect(historyInsertOneMock).toHaveBeenCalledWith(
			expect.objectContaining({
				game_id: GAME_ID,
				timeout: 11,
				winner_id: 12,
				end_reason: "per-move-timeout"
			})
		)
		expect(emitGameEndedMock).toHaveBeenCalledWith(
			101,
			expect.objectContaining({
				gameId: GAME_ID,
				status: "per-move-timeout",
				winnerId: 12,
				isDraw: false
			})
		)
	})

	it("classifies a mid-game per-move flag correctly (multiple moves + increment)", async () => {
		// Black has ~30min of whole-game time left but sits out one move past the 30s cap.
		// Mid-game, with increment and spent time, this must still be a per-move timeout:
		// black (12) loses, red (11) wins outright.
		setConfig({ time_limit: 1800, time_increment: 5, time_per_move: 30 })
		const fen = "4G4/9/9/9/9/9/9/9/9/4g4"
		setHistory([
			{ team: "red", time_stamp: T0 - 60, fen },
			{ team: "black", time_stamp: T0 - 50, fen },
			{ team: "red", time_stamp: T0 - 40, fen },
			{ team: "black", time_stamp: T0, fen }
		])

		await armClock(GAME_ID)
		await vi.advanceTimersByTimeAsync(30_000)

		expect(runEndGameTransactionMock).toHaveBeenCalledWith(
			expect.objectContaining({ gameId: GAME_ID, winnerId: BigInt(11), endReason: "per-move-timeout" })
		)
		expect(emitGameEndedMock).toHaveBeenCalledWith(
			101,
			expect.objectContaining({
				gameId: GAME_ID,
				status: "per-move-timeout",
				winnerId: 11,
				isDraw: false
			})
		)
	})

	it("uses the whole-game timeout (river draw) when total time runs out first, even with per-move on", async () => {
		// Per-move cap (60s) is looser than the 30s of total left, so the total budget
		// flags first at 30s -> a whole-game timeout, which draws without crossing material.
		setConfig({ time_limit: 30, time_per_move: 60 })
		setHistory([{ team: "red", time_stamp: T0, fen: "4G4/9/9/9/9/9/9/9/9/4g4" }])

		await armClock(GAME_ID)
		await vi.advanceTimersByTimeAsync(30_000)

		expect(runEndGameTransactionMock).toHaveBeenCalledWith(
			expect.objectContaining({ gameId: GAME_ID, winnerId: null, endReason: "timeout" })
		)
		expect(emitGameEndedMock).toHaveBeenCalledWith(
			101,
			expect.objectContaining({ status: "timeout", winnerId: null, isDraw: true })
		)
	})

	it("returns a snapshot and flags the active team when time runs out", async () => {
		setConfig()
		// Black wins on time and has a chariot across the river -> real win.
		setHistory([{ team: "red", time_stamp: T0, fen: "4G4/9/9/9/9/9/9/9/9/R8" }])

		const snapshot = await armClock(GAME_ID)
		expect(snapshot).toMatchObject({
			activeTeam: "red",
			redMs: 60_000,
			blackMs: 60_000,
			timeLimit: 60
		})

		await vi.advanceTimersByTimeAsync(60_000)

		expect(runEndGameTransactionMock).toHaveBeenCalledWith(
			expect.objectContaining({ gameId: GAME_ID, winnerId: BigInt(12) })
		)
		expect(historyInsertOneMock).toHaveBeenCalledWith(
			expect.objectContaining({ game_id: GAME_ID, timeout: 11, winner_id: 12 })
		)
		expect(emitGameEndedMock).toHaveBeenCalledWith(
			101,
			expect.objectContaining({
				gameId: GAME_ID,
				status: "timeout",
				winnerId: 12,
				isDraw: false
			})
		)
	})

	it("declares a draw when the player with time left has no crossing material", async () => {
		setConfig()
		// Black wins on time but only has a bare general -> draw (vi.json p4).
		setHistory([{ team: "red", time_stamp: T0, fen: "4G4/9/9/9/9/9/9/9/9/4g4" }])

		await armClock(GAME_ID)
		await vi.advanceTimersByTimeAsync(60_000)

		expect(runEndGameTransactionMock).toHaveBeenCalledWith(
			expect.objectContaining({ gameId: GAME_ID, winnerId: null })
		)
		expect(emitGameEndedMock).toHaveBeenCalledWith(
			101,
			expect.objectContaining({ status: "timeout", winnerId: null, isDraw: true })
		)
	})

	it("does not end the game if a move landed before the deadline (turn changed)", async () => {
		setConfig()
		setHistory([{ team: "red", time_stamp: T0, fen: "x" }])
		await armClock(GAME_ID)

		// Red moved just in time: black is now on the move, so the old red-flag must no-op.
		setHistory([
			{ team: "red", time_stamp: T0, fen: "x" },
			{ team: "black", time_stamp: T0 + 59, fen: "y" }
		])

		await vi.advanceTimersByTimeAsync(60_000)
		expect(runEndGameTransactionMock).not.toHaveBeenCalled()
	})
})
