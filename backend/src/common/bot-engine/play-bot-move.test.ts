import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { playBotMove } from "./play-bot-move"
import {
	PERPETUAL_CHECK_LOSS_REPETITION,
	PERPETUAL_CHECK_WARNING_REPETITION
} from "../game/perpetual-check.helper"

const {
	requestBotMoveMock,
	insertOneMock,
	findToArrayMock,
	gameHistoryCreateMock,
	roomFindUniqueMock,
	roomUserFindManyMock,
	gameUpdateMock,
	roomUpdateMock,
	transactionMock,
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
	roomUserFindManyMock: vi.fn(),
	gameUpdateMock: vi.fn(),
	roomUpdateMock: vi.fn(),
	transactionMock: vi.fn(),
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
		room: { findUnique: roomFindUniqueMock, update: roomUpdateMock },
		roomUser: { findMany: roomUserFindManyMock },
		game: { update: gameUpdateMock },
		$transaction: transactionMock
	}
}))

vi.mock("../socket", () => ({
	emitMovePiece: emitMovePieceMock,
	emitPerpetualCheckWarning: emitPerpetualCheckWarningMock,
	emitSurrender: emitSurrenderMock
}))

vi.mock("../game/state-evaluator", () => ({ evaluateTeamState: evaluateTeamStateMock }))
// Keep the real threshold constants, mock only the evaluation functions.
vi.mock("../game/perpetual-check.helper", async importActual => ({
	...(await importActual<typeof import("../game/perpetual-check.helper")>()),
	evaluatePerpetualCheck: evaluatePerpetualCheckMock,
	wouldCompletePerpetualLoss: wouldCompletePerpetualLossMock
}))
vi.mock("../game/conclude-game.helper", () => ({ concludeGame: concludeGameMock }))
vi.mock("../game/presence-sync", () => ({ syncPlayersPresence: vi.fn() }))

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
		requestBotMoveMock.mockResolvedValue({
			newFen: "RHEAGAEHR/9/1C5C1/S1S1S1S1S/9/9/s1s1s1s1s/1c5c1/9/rheagaehr",
			capturePiece: null
		})
		// A valid previous FEN so the real isSoldierAdvance(prevFen, newFen) never throws.
		findToArrayMock.mockResolvedValue([
			{ fen: "RHEAGAEHR/9/1C5C1/S1S1S1S1S/9/9/s1s1s1s1s/1c5c1/9/rheagaehr w - - 0 1" }
		])
		insertOneMock.mockResolvedValue({ insertedId: { toString: () => "mongo-1" } })
		gameHistoryCreateMock.mockResolvedValue({})
		roomFindUniqueMock.mockResolvedValue({ pve_mode: true, bet_amount: 50 })
		roomUserFindManyMock.mockResolvedValue([])
		transactionMock.mockResolvedValue([])
		concludeGameMock.mockResolvedValue({ ended: true, winnerId: 22 })
	})

	afterEach(() => {
		vi.clearAllMocks()
	})

	it("auto-surrenders the bot with winner and reason when it has no legal moves", async () => {
		// Bot (red) has no move -> it surrenders; the terminal record must carry the
		// human winner and the surrender reason, like every other end path.
		requestBotMoveMock.mockResolvedValue(null)
		roomUserFindManyMock.mockResolvedValue([
			{ user_id: 22n, team: "black" },
			{ user_id: 999n, team: "red" }
		])

		const result = await playBotMove(PARAMS)

		expect(result).toBeNull()
		expect(insertOneMock).toHaveBeenCalledWith(
			expect.objectContaining({
				game_id: "game-1",
				team: "black",
				surrender_id: 999,
				winner_id: 22,
				end_reason: "surrender"
			})
		)
		expect(emitSurrenderMock).toHaveBeenCalledWith("5", "game-1", 999)
	})

	it("ends the game in a draw when the bot's move leaves neither side any attacking material", async () => {
		// The bot's capture removes the last attacker; only generals + advisors remain.
		requestBotMoveMock.mockResolvedValue({
			newFen: "3AGA3/9/9/9/9/9/9/9/9/3aga3",
			capturePiece: "s"
		})
		evaluateTeamStateMock.mockReturnValue({ inCheck: false, legalMovesCount: 5, status: "ongoing" })

		await playBotMove(PARAMS)

		expect(concludeGameMock).toHaveBeenCalledWith({
			gameId: "game-1",
			roomId: 5n,
			winnerTeam: null,
			isBotGame: true,
			betAmount: 50,
			statusForEvent: "draw"
		})
		// A draw short-circuits before the perpetual-check safety net.
		expect(evaluatePerpetualCheckMock).not.toHaveBeenCalled()
	})

	it("ends the game in a draw when the bot's move reaches the natural move-limit", async () => {
		const FULL_BOARD = "RHEAGAEHR/9/1C5C1/S1S1S1S1S/9/9/s1s1s1s1s/1c5c1/9/rheagaehr"
		// Prev no-progress clock at 99; the bot's non-capturing, non-advancing move makes it 100.
		findToArrayMock.mockResolvedValue([{ fen: `${FULL_BOARD} w - - 99 50` }])
		requestBotMoveMock.mockResolvedValue({ newFen: FULL_BOARD, capturePiece: null })
		evaluateTeamStateMock.mockReturnValue({ inCheck: false, legalMovesCount: 5, status: "ongoing" })

		await playBotMove(PARAMS)

		expect(concludeGameMock).toHaveBeenCalledWith({
			gameId: "game-1",
			roomId: 5n,
			winnerTeam: null,
			isBotGame: true,
			betAmount: 50,
			statusForEvent: "draw"
		})
		expect(evaluatePerpetualCheckMock).not.toHaveBeenCalled()
	})

	it("ends the game (human wins) when the bot's move completes a perpetual check", async () => {
		evaluateTeamStateMock.mockReturnValue({ inCheck: true, legalMovesCount: 1, status: "check" })
		evaluatePerpetualCheckMock.mockResolvedValue({
			status: "loss",
			occurrencesCount: PERPETUAL_CHECK_LOSS_REPETITION
		})

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
		evaluatePerpetualCheckMock.mockResolvedValue({
			status: "warning",
			occurrencesCount: PERPETUAL_CHECK_WARNING_REPETITION
		})

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
