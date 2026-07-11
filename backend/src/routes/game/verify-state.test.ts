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

const redisGetMock = vi.fn()
const evaluateTeamStateMock = vi.fn()
const runEndGameTransactionMock = vi.fn()
const activatePostGameLockMock = vi.fn()
const syncPlayersPresenceMock = vi.fn()
const emitGameEndedMock = vi.fn()
const findGameHistoryMock = vi.fn()
const sortGameHistoryMock = vi.fn()
const limitGameHistoryMock = vi.fn()
const toArrayGameHistoryMock = vi.fn()
const updateOneGameHistoryMock = vi.fn()
const getGameHistoryCollectionMock = vi.fn()
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
	emitGameEnded: emitGameEndedMock
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
		// FEN shape is variant-specific, so it is validated after the game (and thus
		// its variant) is resolved.
		gameFindUniqueMock.mockResolvedValue({
			id: "game-1",
			room_id: 11n,
			room: { bet_amount: 0, pve_mode: false, red_first: true }
		})

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
	})

	it("returns 400 when checkedTeam is invalid", async () => {
		resetRouteMocks()
		const accessToken = buildAccessToken(91, "session-verify-state-3")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 91 }))
		gameFindUniqueMock.mockResolvedValue({
			id: "game-1",
			room_id: 11n,
			room: { bet_amount: 0, pve_mode: false, red_first: true }
		})

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
				game_type: true,
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
			betAmount: 100
		})
		expect(updateOneGameHistoryMock).toHaveBeenCalledWith(
			{ _id: "mongo-last-id" },
			{ $set: { winner_id: 91 } }
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
			betAmount: 200
		})
		expect(updateOneGameHistoryMock).toHaveBeenCalledWith(
			{ _id: "mongo-last-id-stalemate" },
			{ $set: { winner_id: 102 } }
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

	it("ends a chess game on checkmate using the real chess evaluator (white loses)", async () => {
		resetRouteMocks()
		// evaluateTeamState is xiangqi-only; chess uses the real chess evaluator,
		// so we do NOT mock the outcome here.
		toArrayGameHistoryMock.mockResolvedValue([{ _id: "mongo-chess-mate" }])

		const accessToken = buildAccessToken(91, "session-verify-state-chess")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 91 }))
		gameFindUniqueMock.mockResolvedValue({
			id: "chess-1",
			room_id: 21n,
			game_type: "chess",
			room: { bet_amount: 50, pve_mode: false, red_first: true }
		})
		roomUserFindManyMock.mockResolvedValue([
			{ user_id: 91n, team: "white" },
			{ user_id: 92n, team: "black" }
		])

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({
				gameId: "chess-1",
				// Fool's mate: white is checkmated, so black (user 92) wins.
				newFen: "rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3",
				checkedTeam: "white"
			})

		expect(res.status).toBe(200)
		expect(res.body.data).toMatchObject({
			gameEnded: true,
			status: "checkmate",
			winnerId: 92,
			checkedTeam: "white"
		})
		expect(runEndGameTransactionMock).toHaveBeenCalledWith({
			gameId: "chess-1",
			roomId: 21n,
			winnerId: 92n,
			isBotGame: false,
			betAmount: 50
		})
		expect(emitGameEndedMock).toHaveBeenCalledWith(21, {
			gameId: "chess-1",
			status: "checkmate",
			winnerId: 92
		})
		expect(stopClockMock).toHaveBeenCalledWith("chess-1")
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
