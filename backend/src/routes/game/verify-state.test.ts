import express from "express"
import jwt from "jsonwebtoken"
import request from "supertest"
import {
	afterEach,
	beforeAll,
	describe,
	expect,
	it,
	vi
} from "vitest"
import { INITIAL_FEN_BLACK_TOP } from "common/constant"
import {
	PERPETUAL_CHECK_LOSS_REPETITION,
	PERPETUAL_CHECK_WARNING_REPETITION
} from "common/game/perpetual-check.helper"

// Hoisted so the perpetual-check importActual mock (which loads the real module and in
// turn triggers the mongodb/state-evaluator mocks) sees these already initialised.
const { evaluateTeamStateMock, evaluatePerpetualCheckMock, getGameHistoryCollectionMock } =
	vi.hoisted(() => ({
		evaluateTeamStateMock: vi.fn(),
		evaluatePerpetualCheckMock: vi.fn(),
		getGameHistoryCollectionMock: vi.fn()
	}))
const redisGetMock = vi.fn()
const runEndGameTransactionMock = vi.fn()
const activatePostGameLockMock = vi.fn()
const syncPlayersPresenceMock = vi.fn()
const emitGameEndedMock = vi.fn()
const emitPerpetualCheckWarningMock = vi.fn()
const findGameHistoryMock = vi.fn()
const sortGameHistoryMock = vi.fn()
const limitGameHistoryMock = vi.fn()
const toArrayGameHistoryMock = vi.fn()
const updateOneGameHistoryMock = vi.fn()
const gameFindUniqueMock = vi.fn()
const roomUserFindManyMock = vi.fn()
const stopClockMock = vi.fn()

const PATH = "/api/game/verify-state"

vi.mock("../../common/redis", () => ({
	default: {
		get: redisGetMock
	}
}))

vi.mock("common/game/state-evaluator", () => ({
	evaluateTeamState: evaluateTeamStateMock
}))

// Keep the real threshold constants, mock only the evaluation function.
vi.mock("common/game/perpetual-check.helper", async importActual => ({
	...(await importActual<typeof import("common/game/perpetual-check.helper")>()),
	evaluatePerpetualCheck: evaluatePerpetualCheckMock
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

vi.mock("common/mongodb", () => ({
	getGameHistoryCollection: getGameHistoryCollectionMock
}))

vi.mock("common/socket", () => ({
	emitGameEnded: emitGameEndedMock,
	emitPerpetualCheckWarning: emitPerpetualCheckWarningMock
}))

vi.mock("common/game/game-clock", () => ({
	stopClock: stopClockMock
}))

vi.mock("prisma", () => ({
	default: {
		game: {
			findUnique: gameFindUniqueMock
		},
		roomUser: {
			findMany: roomUserFindManyMock
		}
	}
}))

describe("POST /api/game/verify-state", () => {
	let app: express.Express
	let consoleErrorSpy: ReturnType<typeof vi.spyOn>

	beforeAll(async () => {
		process.env.JWT_SECRET = "unit-test-secret"
		process.env.JWT_ISSUER = "unit-test-issuer"

		const { default: verifyStateRoutes } = await import("./verify-state")
		app = express()
		app.use(express.json())
		app.use("/api", verifyStateRoutes)
	})

	afterEach(() => {
		vi.clearAllMocks()
		consoleErrorSpy?.mockRestore()
	})

	const resetRouteMocks = () => {
		evaluateTeamStateMock.mockReturnValue({
			inCheck: true,
			legalMovesCount: 1,
			status: "check"
		})
		evaluatePerpetualCheckMock.mockResolvedValue({ status: "none", occurrencesCount: 1 })
		runEndGameTransactionMock.mockResolvedValue(true)
		activatePostGameLockMock.mockResolvedValue(undefined)
		syncPlayersPresenceMock.mockResolvedValue(undefined)
		findGameHistoryMock.mockReturnValue({ sort: sortGameHistoryMock })
		sortGameHistoryMock.mockReturnValue({ limit: limitGameHistoryMock })
		limitGameHistoryMock.mockReturnValue({ toArray: toArrayGameHistoryMock })
		toArrayGameHistoryMock.mockResolvedValue([])
		updateOneGameHistoryMock.mockResolvedValue({ modifiedCount: 0 })
		getGameHistoryCollectionMock.mockResolvedValue({
			find: findGameHistoryMock,
			updateOne: updateOneGameHistoryMock
		})
	}

	const buildAccessToken = (userId: number, sessionId: string) =>
		jwt.sign({ sub: userId, jti: sessionId }, process.env.JWT_SECRET as string, {
			issuer: process.env.JWT_ISSUER,
			expiresIn: "1h"
		})

	it("returns 401 when authorization token is missing", async () => {
		const res = await request(app).post(PATH).send({
			gameId: "game-1",
			newFen: INITIAL_FEN_BLACK_TOP,
			checkedTeam: "black"
		})

		expect(res.status).toBe(401)
		expect(res.body).toMatchObject({
			success: false,
			message: "auth-middleware.messages.token-required",
			status_code: 401
		})
	})

	it("returns 400 when gameId is invalid", async () => {
		resetRouteMocks()
		const accessToken = buildAccessToken(91, "session-verify-state-1")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 91 }))

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({
				gameId: 123,
				newFen: INITIAL_FEN_BLACK_TOP,
				checkedTeam: "black"
			})

		expect(res.status).toBe(400)
		expect(res.body).toMatchObject({
			success: false,
			message: "verify-state.messages.invalid-game-id",
			status_code: 400
		})
		expect(gameFindUniqueMock).not.toHaveBeenCalled()
	})

	it("returns 400 when fen is invalid", async () => {
		resetRouteMocks()
		const accessToken = buildAccessToken(91, "session-verify-state-2")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 91 }))

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({
				gameId: "game-1",
				newFen: "invalid-fen",
				checkedTeam: "black"
			})

		expect(res.status).toBe(400)
		expect(res.body).toMatchObject({
			success: false,
			message: "verify-state.messages.invalid-fen",
			status_code: 400
		})
		expect(gameFindUniqueMock).not.toHaveBeenCalled()
	})

	it("returns 400 when checkedTeam is invalid", async () => {
		resetRouteMocks()
		const accessToken = buildAccessToken(91, "session-verify-state-3")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 91 }))

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({
				gameId: "game-1",
				newFen: INITIAL_FEN_BLACK_TOP,
				checkedTeam: "blue"
			})

		expect(res.status).toBe(400)
		expect(res.body).toMatchObject({
			success: false,
			message: "verify-state.messages.invalid-team",
			status_code: 400
		})
		expect(gameFindUniqueMock).not.toHaveBeenCalled()
	})

	it("returns 404 when game does not exist", async () => {
		resetRouteMocks()
		const accessToken = buildAccessToken(91, "session-verify-state-4")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 91 }))
		gameFindUniqueMock.mockResolvedValue(null)

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({
				gameId: "game-1",
				newFen: INITIAL_FEN_BLACK_TOP,
				checkedTeam: "black"
			})

		expect(res.status).toBe(404)
		expect(gameFindUniqueMock).toHaveBeenCalledWith({
			where: { id: "game-1" },
			select: {
				id: true,
				room_id: true,
				room: {
					select: {
						bet_amount: true,
						pve_mode: true,
						red_first: true
					}
				}
			}
		})
		expect(res.body).toMatchObject({
			success: false,
			message: "verify-state.messages.game-not-found",
			status_code: 404
		})
	})

	it("returns 200 with check status", async () => {
		resetRouteMocks()
		const accessToken = buildAccessToken(91, "session-verify-state-5")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 91 }))
		gameFindUniqueMock.mockResolvedValue({
			id: "game-1",
			room_id: 11n,
			room: {
				bet_amount: 100,
				pve_mode: false,
				red_first: true
			}
		})

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({
				gameId: "game-1",
				newFen: "4g4/9/4r4/9/9/9/9/9/9/4G4",
				checkedTeam: "black"
			})

		expect(res.status).toBe(200)
		expect(res.body).toMatchObject({
			success: true,
			message: "verify-state.messages.success",
			status_code: 200,
			data: {
				gameEnded: false,
				inCheck: true,
				status: "check",
				checkedTeam: "black",
				winnerId: null
			}
		})
		expect(res.body.data.legalMovesCount).toBeGreaterThan(0)
		expect(runEndGameTransactionMock).not.toHaveBeenCalled()
		// Game continues -> the clock keeps running.
		expect(stopClockMock).not.toHaveBeenCalled()
	})

	it("ends the game on perpetual check with the checked side as the winner", async () => {
		resetRouteMocks()
		// A plain check (not checkmate), but detected as perpetual check.
		evaluateTeamStateMock.mockReturnValue({
			inCheck: true,
			legalMovesCount: 3,
			status: "check"
		})
		evaluatePerpetualCheckMock.mockResolvedValue({
			status: "loss",
			occurrencesCount: PERPETUAL_CHECK_LOSS_REPETITION
		})
		toArrayGameHistoryMock.mockResolvedValue([{ _id: "mongo-last-id-perpetual" }])

		const accessToken = buildAccessToken(91, "session-verify-state-perpetual")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 91 }))
		gameFindUniqueMock.mockResolvedValue({
			id: "game-3",
			room_id: 13n,
			room: {
				bet_amount: 150,
				pve_mode: false,
				red_first: true
			}
		})
		roomUserFindManyMock.mockResolvedValue([
			{ user_id: 201n, team: "red" },
			{ user_id: 202n, team: "black" }
		])

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({
				gameId: "game-3",
				newFen: "4g4/9/4r4/9/9/9/9/9/9/4G4",
				checkedTeam: "black"
			})

		expect(res.status).toBe(200)
		// The checked side (black) wins; the perpetual checker (red) loses.
		expect(runEndGameTransactionMock).toHaveBeenCalledWith({
			gameId: "game-3",
			roomId: 13n,
			winnerId: 202n,
			isBotGame: false,
			betAmount: 150,
			endReason: "perpetual-check"
		})
		expect(emitGameEndedMock).toHaveBeenCalledWith(13, {
			gameId: "game-3",
			status: "perpetual-check",
			winnerId: 202
		})
		expect(stopClockMock).toHaveBeenCalledWith("game-3")
		expect(res.body.data).toMatchObject({
			gameEnded: true,
			status: "perpetual-check",
			winnerId: 202,
			checkedTeam: "black"
		})
	})

	it("warns both sides (no game end) when perpetual check reaches the warning stage", async () => {
		resetRouteMocks()
		evaluateTeamStateMock.mockReturnValue({
			inCheck: true,
			legalMovesCount: 3,
			status: "check"
		})
		evaluatePerpetualCheckMock.mockResolvedValue({
			status: "warning",
			occurrencesCount: PERPETUAL_CHECK_WARNING_REPETITION
		})

		const accessToken = buildAccessToken(91, "session-verify-state-warning")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 91 }))
		gameFindUniqueMock.mockResolvedValue({
			id: "game-5",
			room_id: 15n,
			room: { bet_amount: 100, pve_mode: false, red_first: true }
		})

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({
				gameId: "game-5",
				newFen: "4g4/9/4r4/9/9/9/9/9/9/4G4",
				checkedTeam: "black"
			})

		expect(res.status).toBe(200)
		expect(res.body.data).toMatchObject({
			gameEnded: false,
			status: "check",
			occurrences: PERPETUAL_CHECK_WARNING_REPETITION
		})
		// Offender is the checker (red); the checked side is black.
		expect(emitPerpetualCheckWarningMock).toHaveBeenCalledWith(15, {
			gameId: "game-5",
			offenderTeam: "red",
			checkedTeam: "black"
		})
		expect(runEndGameTransactionMock).not.toHaveBeenCalled()
		expect(stopClockMock).not.toHaveBeenCalled()
	})

	it("does not end the game on a check that is not perpetual", async () => {
		resetRouteMocks()
		evaluateTeamStateMock.mockReturnValue({
			inCheck: true,
			legalMovesCount: 2,
			status: "check"
		})
		evaluatePerpetualCheckMock.mockResolvedValue({ status: "none", occurrencesCount: 1 })

		const accessToken = buildAccessToken(91, "session-verify-state-not-perpetual")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 91 }))
		gameFindUniqueMock.mockResolvedValue({
			id: "game-4",
			room_id: 14n,
			room: { bet_amount: 100, pve_mode: false, red_first: true }
		})

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({
				gameId: "game-4",
				newFen: "4g4/9/4r4/9/9/9/9/9/9/4G4",
				checkedTeam: "black"
			})

		expect(res.status).toBe(200)
		expect(res.body.data).toMatchObject({ gameEnded: false, status: "check", occurrences: 1 })
		expect(runEndGameTransactionMock).not.toHaveBeenCalled()
		expect(emitPerpetualCheckWarningMock).not.toHaveBeenCalled()
		expect(stopClockMock).not.toHaveBeenCalled()
	})

	it("ends the game on checkmate, updates latest history winner_id and emits game-ended", async () => {
		resetRouteMocks()
		evaluateTeamStateMock.mockReturnValue({
			inCheck: true,
			legalMovesCount: 0,
			status: "checkmate"
		})
		toArrayGameHistoryMock.mockResolvedValue([{ _id: "mongo-last-id" }])

		const accessToken = buildAccessToken(91, "session-verify-state-checkmate")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 91 }))
		gameFindUniqueMock.mockResolvedValue({
			id: "game-1",
			room_id: 11n,
			room: {
				bet_amount: 100,
				pve_mode: false,
				red_first: true
			}
		})
		roomUserFindManyMock.mockResolvedValue([
			{ user_id: 91n, team: "red" },
			{ user_id: 92n, team: "black" }
		])

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({
				gameId: "game-1",
				newFen: INITIAL_FEN_BLACK_TOP,
				checkedTeam: "black"
			})

		expect(res.status).toBe(200)
		expect(runEndGameTransactionMock).toHaveBeenCalledWith({
			gameId: "game-1",
			roomId: 11n,
			winnerId: 91n,
			isBotGame: false,
			betAmount: 100,
			endReason: "checkmate"
		})
		expect(updateOneGameHistoryMock).toHaveBeenCalledWith(
			{ _id: "mongo-last-id" },
			{ $set: { winner_id: 91, end_reason: "checkmate" } }
		)
		expect(emitGameEndedMock).toHaveBeenCalledWith(11, {
			gameId: "game-1",
			status: "checkmate",
			winnerId: 91
		})
		expect(activatePostGameLockMock).toHaveBeenCalledWith(11n, "game-1")
		// Checkmate ends the game -> the countdown clock is stopped.
		expect(stopClockMock).toHaveBeenCalledWith("game-1")
		expect(res.body.data).toMatchObject({
			gameEnded: true,
			status: "checkmate",
			winnerId: 91,
			checkedTeam: "black"
		})
	})

	it("ends the game on stalemate and still awards winner to the opposing team", async () => {
		resetRouteMocks()
		evaluateTeamStateMock.mockReturnValue({
			inCheck: false,
			legalMovesCount: 0,
			status: "stalemate"
		})
		toArrayGameHistoryMock.mockResolvedValue([{ _id: "mongo-last-id-stalemate" }])

		const accessToken = buildAccessToken(91, "session-verify-state-stalemate")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 91 }))
		gameFindUniqueMock.mockResolvedValue({
			id: "game-2",
			room_id: 12n,
			room: {
				bet_amount: 200,
				pve_mode: false,
				red_first: true
			}
		})
		roomUserFindManyMock.mockResolvedValue([
			{ user_id: 101n, team: "red" },
			{ user_id: 102n, team: "black" }
		])

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({
				gameId: "game-2",
				newFen: INITIAL_FEN_BLACK_TOP,
				checkedTeam: "red"
			})

		expect(res.status).toBe(200)
		expect(runEndGameTransactionMock).toHaveBeenCalledWith({
			gameId: "game-2",
			roomId: 12n,
			winnerId: 102n,
			isBotGame: false,
			betAmount: 200,
			endReason: "stalemate"
		})
		expect(updateOneGameHistoryMock).toHaveBeenCalledWith(
			{ _id: "mongo-last-id-stalemate" },
			{ $set: { winner_id: 102, end_reason: "stalemate" } }
		)
		expect(emitGameEndedMock).toHaveBeenCalledWith(12, {
			gameId: "game-2",
			status: "stalemate",
			winnerId: 102
		})
		expect(activatePostGameLockMock).toHaveBeenCalledWith(12n, "game-2")
		expect(res.body.data).toMatchObject({
			gameEnded: true,
			status: "stalemate",
			winnerId: 102,
			checkedTeam: "red"
		})
	})

	it("ends the game in a draw when neither side has attacking material left", async () => {
		resetRouteMocks()
		// Not a mate/stalemate: an ordinary position that just lost its last attacker.
		evaluateTeamStateMock.mockReturnValue({
			inCheck: false,
			legalMovesCount: 5,
			status: "ongoing"
		})
		toArrayGameHistoryMock.mockResolvedValue([{ _id: "mongo-last-id-draw" }])

		const accessToken = buildAccessToken(91, "session-verify-state-draw")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 91 }))
		gameFindUniqueMock.mockResolvedValue({
			id: "game-6",
			room_id: 16n,
			room: { bet_amount: 100, pve_mode: false, red_first: true }
		})
		roomUserFindManyMock.mockResolvedValue([
			{ user_id: 301n, team: "red" },
			{ user_id: 302n, team: "black" }
		])

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({
				gameId: "game-6",
				// Only generals + advisors remain on both sides.
				newFen: "3AGA3/9/9/9/9/9/9/9/9/3aga3",
				checkedTeam: "black"
			})

		expect(res.status).toBe(200)
		// A draw has no winner.
		expect(runEndGameTransactionMock).toHaveBeenCalledWith({
			gameId: "game-6",
			roomId: 16n,
			winnerId: null,
			isBotGame: false,
			betAmount: 100,
			endReason: "draw"
		})
		expect(updateOneGameHistoryMock).toHaveBeenCalledWith(
			{ _id: "mongo-last-id-draw" },
			{ $set: { winner_id: null, end_reason: "draw" } }
		)
		expect(emitGameEndedMock).toHaveBeenCalledWith(16, {
			gameId: "game-6",
			status: "draw",
			winnerId: null
		})
		expect(stopClockMock).toHaveBeenCalledWith("game-6")
		expect(res.body.data).toMatchObject({
			gameEnded: true,
			status: "draw",
			winnerId: null,
			checkedTeam: "black"
		})
	})

	it("ends the game in a draw when the natural move-limit is reached", async () => {
		resetRouteMocks()
		// Ordinary position (attackers still on board), but the no-progress clock is at the limit.
		evaluateTeamStateMock.mockReturnValue({
			inCheck: false,
			legalMovesCount: 5,
			status: "ongoing"
		})
		toArrayGameHistoryMock.mockResolvedValue([
			{ _id: "mongo-last-id-nml", fen: `${INITIAL_FEN_BLACK_TOP} b - - 100 50` }
		])

		const accessToken = buildAccessToken(91, "session-verify-state-nml")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 91 }))
		gameFindUniqueMock.mockResolvedValue({
			id: "game-7",
			room_id: 17n,
			room: { bet_amount: 100, pve_mode: false, red_first: true }
		})
		roomUserFindManyMock.mockResolvedValue([
			{ user_id: 401n, team: "red" },
			{ user_id: 402n, team: "black" }
		])

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({
				gameId: "game-7",
				newFen: INITIAL_FEN_BLACK_TOP,
				checkedTeam: "black"
			})

		expect(res.status).toBe(200)
		expect(runEndGameTransactionMock).toHaveBeenCalledWith({
			gameId: "game-7",
			roomId: 17n,
			winnerId: null,
			isBotGame: false,
			betAmount: 100,
			endReason: "draw"
		})
		expect(emitGameEndedMock).toHaveBeenCalledWith(17, {
			gameId: "game-7",
			status: "draw",
			winnerId: null
		})
		expect(res.body.data).toMatchObject({
			gameEnded: true,
			status: "draw",
			winnerId: null
		})
	})

	it("returns 500 when database throws unexpected error", async () => {
		resetRouteMocks()
		const accessToken = buildAccessToken(91, "session-verify-state-6")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 91 }))
		consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined)
		gameFindUniqueMock.mockRejectedValue(new Error("db down"))

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({
				gameId: "game-1",
				newFen: INITIAL_FEN_BLACK_TOP,
				checkedTeam: "black"
			})

		expect(res.status).toBe(500)
		expect(res.body).toMatchObject({
			success: false,
			message: "verify-state.messages.internal-server-error",
			status_code: 500
		})
	})
})
