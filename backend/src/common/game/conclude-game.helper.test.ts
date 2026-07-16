import { afterEach, describe, expect, it, vi } from "vitest"

const {
	roomUserFindManyMock,
	runEndGameTransactionMock,
	stopClockMock,
	activatePostGameLockMock,
	syncPlayersPresenceMock,
	updateOneMock,
	toArrayMock,
	emitGameEndedMock
} = vi.hoisted(() => ({
	roomUserFindManyMock: vi.fn(),
	runEndGameTransactionMock: vi.fn(),
	stopClockMock: vi.fn(),
	activatePostGameLockMock: vi.fn(),
	syncPlayersPresenceMock: vi.fn(),
	updateOneMock: vi.fn(),
	toArrayMock: vi.fn(),
	emitGameEndedMock: vi.fn()
}))

vi.mock("prisma", () => ({
	default: {
		roomUser: { findMany: roomUserFindManyMock }
	}
}))

vi.mock("../mongodb", () => ({
	getGameHistoryCollection: vi.fn().mockResolvedValue({
		find: () => ({ sort: () => ({ limit: () => ({ toArray: toArrayMock }) }) }),
		updateOne: updateOneMock
	})
}))

vi.mock("../socket", () => ({ emitGameEnded: emitGameEndedMock }))
vi.mock("./end-game.helper", () => ({ runEndGameTransaction: runEndGameTransactionMock }))
vi.mock("./game-clock", () => ({ stopClock: stopClockMock }))
vi.mock("./post-game.helper", () => ({ activatePostGameLock: activatePostGameLockMock }))
vi.mock("./presence-sync", () => ({ syncPlayersPresence: syncPlayersPresenceMock }))

import { concludeGame } from "./conclude-game.helper"

describe("concludeGame", () => {
	afterEach(() => {
		vi.clearAllMocks()
	})

	it("settles the winner and runs post-game side effects when it claims the game", async () => {
		roomUserFindManyMock.mockResolvedValue([
			{ user_id: 11n, team: "red" },
			{ user_id: 22n, team: "black" }
		])
		runEndGameTransactionMock.mockResolvedValue(true)
		activatePostGameLockMock.mockResolvedValue(undefined)
		syncPlayersPresenceMock.mockResolvedValue(undefined)
		toArrayMock.mockResolvedValue([{ _id: "mongo-id" }])
		updateOneMock.mockResolvedValue({ modifiedCount: 1 })

		const result = await concludeGame({
			gameId: "game-1",
			roomId: 5n,
			winnerTeam: "black",
			isBotGame: false,
			betAmount: 100,
			statusForEvent: "perpetual-check"
		})

		expect(result).toEqual({ ended: true, winnerId: 22 })
		expect(runEndGameTransactionMock).toHaveBeenCalledWith({
			gameId: "game-1",
			roomId: 5n,
			winnerId: 22n,
			isBotGame: false,
			betAmount: 100,
			endReason: "perpetual-check"
		})
		expect(stopClockMock).toHaveBeenCalledWith("game-1")
		expect(activatePostGameLockMock).toHaveBeenCalledWith(5n, "game-1")
		expect(updateOneMock).toHaveBeenCalledWith({ _id: "mongo-id" }, { $set: { winner_id: 22, end_reason: "perpetual-check" } })
		expect(emitGameEndedMock).toHaveBeenCalledWith(5, {
			gameId: "game-1",
			status: "perpetual-check",
			winnerId: 22
		})
	})

	it("skips side effects when another request already ended the game", async () => {
		roomUserFindManyMock.mockResolvedValue([
			{ user_id: 11n, team: "red" },
			{ user_id: 22n, team: "black" }
		])
		runEndGameTransactionMock.mockResolvedValue(false)

		const result = await concludeGame({
			gameId: "game-1",
			roomId: 5n,
			winnerTeam: "red",
			isBotGame: false,
			betAmount: 100,
			statusForEvent: "checkmate"
		})

		expect(result).toEqual({ ended: false, winnerId: 11 })
		expect(stopClockMock).not.toHaveBeenCalled()
		expect(emitGameEndedMock).not.toHaveBeenCalled()
	})

	it("passes a null winner through for a draw", async () => {
		roomUserFindManyMock.mockResolvedValue([
			{ user_id: 11n, team: "red" },
			{ user_id: 22n, team: "black" }
		])
		runEndGameTransactionMock.mockResolvedValue(true)
		activatePostGameLockMock.mockResolvedValue(undefined)
		syncPlayersPresenceMock.mockResolvedValue(undefined)
		toArrayMock.mockResolvedValue([])

		const result = await concludeGame({
			gameId: "game-1",
			roomId: 5n,
			winnerTeam: null,
			isBotGame: false,
			betAmount: 0,
			statusForEvent: "stalemate"
		})

		expect(result).toEqual({ ended: true, winnerId: null })
		expect(runEndGameTransactionMock).toHaveBeenCalledWith({
			gameId: "game-1",
			roomId: 5n,
			winnerId: null,
			isBotGame: false,
			betAmount: 0,
			endReason: "stalemate"
		})
	})
})
