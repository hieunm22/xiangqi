import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const {
	requestBotMoveMock,
	insertOneMock,
	findToArrayMock,
	gameHistoryCreateMock,
	roomFindUniqueMock,
	emitMovePieceMock,
	emitPerpetualCheckWarningMock,
	emitSurrenderMock,
	evaluateTeamStateMock,
	evaluatePerpetualCheckMock,
	wouldCompletePerpetualLossMock,
	concludeGameMock
} = vi.hoisted(() => ({
	requestBotMoveMock: vi.fn(),
	insertOneMock: vi.fn(),
	findToArrayMock: vi.fn(),
	gameHistoryCreateMock: vi.fn(),
	roomFindUniqueMock: vi.fn(),
	emitMovePieceMock: vi.fn(),
	emitPerpetualCheckWarningMock: vi.fn(),
	emitSurrenderMock: vi.fn(),
	evaluateTeamStateMock: vi.fn(),
	evaluatePerpetualCheckMock: vi.fn(),
	wouldCompletePerpetualLossMock: vi.fn(),
	concludeGameMock: vi.fn()
}))

vi.mock("./index", () => ({
	BOT_USER_ID: 999n,
	requestBotMove: requestBotMoveMock
}))

vi.mock("../mongodb", () => ({
	getGameHistoryCollection: vi.fn().mockResolvedValue({
		find: () => ({ sort: () => ({ limit: () => ({ toArray: findToArrayMock }) }) }),
		insertOne: insertOneMock
	})
}))

vi.mock("prisma", () => ({
	default: {
		gameHistory: { create: gameHistoryCreateMock },
		room: { findUnique: roomFindUniqueMock }
	}
}))

vi.mock("../socket", () => ({
	emitMovePiece: emitMovePieceMock,
	emitPerpetualCheckWarning: emitPerpetualCheckWarningMock,
	emitSurrender: emitSurrenderMock
}))

vi.mock("../game/state-evaluator", () => ({ evaluateTeamState: evaluateTeamStateMock }))
vi.mock("../game/perpetual-check.helper", () => ({
	evaluatePerpetualCheck: evaluatePerpetualCheckMock,
	wouldCompletePerpetualLoss: wouldCompletePerpetualLossMock
}))
vi.mock("../game/conclude-game.helper", () => ({ concludeGame: concludeGameMock }))
vi.mock("../game/presence-sync", () => ({ syncPlayersPresence: vi.fn() }))

import { playBotMove } from "./play-bot-move"

const PARAMS = {
	gameId: "game-1",
	roomId: 5n,
	projectFen: "prev-fen",
	redFirst: true,
	botTeam: "red" as const,
	difficulty: 1
}

describe("playBotMove perpetual check enforcement", () => {
	beforeEach(() => {
		requestBotMoveMock.mockResolvedValue({ newFen: "board-fen", capturePiece: null })
		findToArrayMock.mockResolvedValue([{ fen: "prev-standard" }])
		insertOneMock.mockResolvedValue({ insertedId: { toString: () => "mongo-1" } })
		gameHistoryCreateMock.mockResolvedValue({})
		roomFindUniqueMock.mockResolvedValue({ pve_mode: true, bet_amount: 50 })
		concludeGameMock.mockResolvedValue({ ended: true, winnerId: 22 })
	})

	afterEach(() => {
		vi.clearAllMocks()
	})

	it("ends the game (human wins) when the bot's move completes a perpetual check", async () => {
		evaluateTeamStateMock.mockReturnValue({ inCheck: true, legalMovesCount: 1, status: "check" })
		evaluatePerpetualCheckMock.mockResolvedValue({ status: "loss", occurrencesCount: 4 })

		await playBotMove(PARAMS)

		// Human is the side to move after the bot (bot = red -> human = black).
		expect(concludeGameMock).toHaveBeenCalledWith({
			gameId: "game-1",
			roomId: 5n,
			winnerTeam: "black",
			isBotGame: true,
			betAmount: 50,
			statusForEvent: "perpetual-check"
		})
		expect(emitPerpetualCheckWarningMock).not.toHaveBeenCalled()
	})

	it("warns both sides when the bot's perpetual check reaches the warning stage", async () => {
		evaluateTeamStateMock.mockReturnValue({ inCheck: true, legalMovesCount: 2, status: "check" })
		evaluatePerpetualCheckMock.mockResolvedValue({ status: "warning", occurrencesCount: 3 })

		await playBotMove(PARAMS)

		expect(emitPerpetualCheckWarningMock).toHaveBeenCalledWith(5, {
			gameId: "game-1",
			offenderTeam: "red",
			checkedTeam: "black"
		})
		expect(concludeGameMock).not.toHaveBeenCalled()
	})

	it("does nothing special when the bot's move is not a check", async () => {
		evaluateTeamStateMock.mockReturnValue({ inCheck: false, legalMovesCount: 5, status: "ongoing" })

		await playBotMove(PARAMS)

		expect(evaluatePerpetualCheckMock).not.toHaveBeenCalled()
		expect(concludeGameMock).not.toHaveBeenCalled()
		expect(emitPerpetualCheckWarningMock).not.toHaveBeenCalled()
	})

	it("auto-concludes the game when the bot checkmates the human", async () => {
		evaluateTeamStateMock.mockReturnValue({ inCheck: true, legalMovesCount: 0, status: "checkmate" })

		await playBotMove(PARAMS)

		expect(concludeGameMock).toHaveBeenCalledWith({
			gameId: "game-1",
			roomId: 5n,
			winnerTeam: "red",
			isBotGame: true,
			betAmount: 50,
			statusForEvent: "checkmate"
		})
		expect(evaluatePerpetualCheckMock).not.toHaveBeenCalled()
		expect(emitPerpetualCheckWarningMock).not.toHaveBeenCalled()
	})

	it("passes a rejectMove predicate that avoids a move completing a perpetual-check loss", async () => {
		evaluateTeamStateMock.mockReturnValue({ inCheck: false, legalMovesCount: 5, status: "ongoing" })

		await playBotMove(PARAMS)

		const options = requestBotMoveMock.mock.calls[0][1]
		expect(typeof options.rejectMove).toBe("function")

		// A checking candidate that would complete the losing repetition is rejected...
		evaluateTeamStateMock.mockReturnValue({ inCheck: true, legalMovesCount: 1, status: "check" })
		wouldCompletePerpetualLossMock.mockResolvedValue(true)
		expect(await options.rejectMove({ uci: "x", newFen: "f", capturePiece: null })).toBe(true)

		// ...a non-checking candidate breaks the chain and is always allowed.
		evaluateTeamStateMock.mockReturnValue({ inCheck: false, legalMovesCount: 5, status: "ongoing" })
		wouldCompletePerpetualLossMock.mockClear()
		expect(await options.rejectMove({ uci: "y", newFen: "g", capturePiece: null })).toBe(false)
		expect(wouldCompletePerpetualLossMock).not.toHaveBeenCalled()
	})
})
