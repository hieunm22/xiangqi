import express from "express"
import jwt from "jsonwebtoken"
import request from "supertest"
import {
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi
} from "vitest"
import { INITIAL_FEN_BLACK_TOP } from "common/constant"

const redisGetMock = vi.fn()
const toArrayMock = vi.fn()
const limitMock = vi.fn()
const sortMock = vi.fn()
const findMock = vi.fn()
const insertOneMock = vi.fn()
const getGameHistoryCollectionMock = vi.fn()
const gameHistoryCreateMock = vi.fn()
const gameFindUniqueMock = vi.fn()
const computeClockMock = vi.fn()
const armClockMock = vi.fn()

const PATH = "/api/game/move-piece"

vi.mock("../../common/redis", () => ({
	default: {
		get: redisGetMock
	}
}))

vi.mock("../../common/mongodb", () => ({
	getGameHistoryCollection: getGameHistoryCollectionMock
}))

vi.mock("prisma", () => ({
	default: {
		gameHistory: {
			create: gameHistoryCreateMock
		},
		game: {
			findUnique: gameFindUniqueMock
		}
	}
}))

vi.mock("common/game/game-clock", () => ({
	computeClock: computeClockMock,
	armClock: armClockMock
}))

describe("POST /api/game/move-piece", () => {
	let app: express.Express
	let consoleErrorSpy: ReturnType<typeof vi.spyOn>

	beforeAll(async () => {
		process.env.JWT_SECRET = "unit-test-secret"
		process.env.JWT_ISSUER = "unit-test-issuer"

		const { default: movePieceRoutes } = await import("./move-piece")
		app = express()
		app.use(express.json())
		app.use("/api", movePieceRoutes)
	})

	beforeEach(() => {
		findMock.mockReturnValue({ sort: sortMock })
		sortMock.mockReturnValue({ limit: limitMock })
		limitMock.mockReturnValue({ toArray: toArrayMock })
		getGameHistoryCollectionMock.mockResolvedValue({
			find: findMock,
			insertOne: insertOneMock
		})
		// Default: unclocked game. Individual tests override to exercise the clock.
		computeClockMock.mockResolvedValue(null)
		armClockMock.mockResolvedValue(null)
	})

	afterEach(() => {
		vi.clearAllMocks()
		consoleErrorSpy?.mockRestore()
	})

	const buildAccessToken = (userId: number, sessionId: string) =>
		jwt.sign({ sub: userId, jti: sessionId }, process.env.JWT_SECRET as string, {
			issuer: process.env.JWT_ISSUER,
			expiresIn: "1h"
		})

	it("returns 401 when authorization token is missing", async () => {
		const res = await request(app).post(PATH).send({
			gameId: "game-1",
			newFen: INITIAL_FEN_BLACK_TOP,
			capturePiece: null,
			team: "red"
		})

		expect(res.status).toBe(401)
		expect(res.body).toMatchObject({
			success: false,
			message: "auth-middleware.messages.token-required",
			status_code: 401
		})
	})

	it("returns 400 when gameId is invalid", async () => {
		const accessToken = buildAccessToken(91, "session-move-piece-1")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 91 }))

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({
				gameId: 123,
				newFen: INITIAL_FEN_BLACK_TOP,
				capturePiece: null,
				team: "red"
			})

		expect(res.status).toBe(400)
		expect(res.body).toMatchObject({
			success: false,
			message: "move-piece.messages.invalid-game-id",
			status_code: 400
		})
		expect(getGameHistoryCollectionMock).not.toHaveBeenCalled()
	})

	it("returns 400 when newFen is missing", async () => {
		const accessToken = buildAccessToken(91, "session-move-piece-2")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 91 }))

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({
				gameId: "game-1",
				capturePiece: null,
				team: "red"
			})

		expect(res.status).toBe(400)
		expect(res.body).toMatchObject({
			success: false,
			message: "move-piece.messages.invalid-fen",
			status_code: 400
		})
		expect(getGameHistoryCollectionMock).not.toHaveBeenCalled()
	})

	it("returns 400 when newFen is invalid", async () => {
		const accessToken = buildAccessToken(91, "session-move-piece-3")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 91 }))

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({
				gameId: "game-1",
				newFen: "invalid-fen",
				capturePiece: null,
				team: "red"
			})

		expect(res.status).toBe(400)
		expect(res.body).toMatchObject({
			success: false,
			message: "move-piece.messages.invalid-fen",
			status_code: 400
		})
		expect(getGameHistoryCollectionMock).not.toHaveBeenCalled()
	})

	it("returns 400 when team is invalid", async () => {
		const accessToken = buildAccessToken(91, "session-move-piece-4")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 91 }))

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({
				gameId: "game-1",
				newFen: INITIAL_FEN_BLACK_TOP,
				capturePiece: null,
				team: "blue"
			})

		expect(res.status).toBe(400)
		expect(res.body).toMatchObject({
			success: false,
			message: "move-piece.messages.invalid-team",
			status_code: 400
		})
		expect(getGameHistoryCollectionMock).not.toHaveBeenCalled()
	})

	it("returns 400 when game history is not found", async () => {
		const accessToken = buildAccessToken(91, "session-move-piece-5")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 91 }))
		toArrayMock.mockResolvedValue([])

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({
				gameId: "game-1",
				newFen: INITIAL_FEN_BLACK_TOP,
				capturePiece: null,
				team: "red"
			})

		expect(res.status).toBe(400)
		expect(findMock).toHaveBeenCalledWith({ game_id: "game-1" })
		expect(sortMock).toHaveBeenCalledWith({ _id: -1 })
		expect(limitMock).toHaveBeenCalledWith(1)
		expect(res.body).toMatchObject({
			success: false,
			message: "move-piece.messages.game-history-not-found",
			status_code: 400
		})
		expect(insertOneMock).not.toHaveBeenCalled()
	})

	it("returns 400 when the moving player has already run out of time", async () => {
		const accessToken = buildAccessToken(91, "session-move-piece-timeout")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 91 }))
		toArrayMock.mockResolvedValue([
			{ _id: { toString: () => "mongo-id-prev" }, game_id: "game-1", fen: INITIAL_FEN_BLACK_TOP, team: "red" }
		])
		// Red is on the move but has 0ms left -> the move is rejected.
		computeClockMock.mockResolvedValue({
			redMs: 0,
			blackMs: 30000,
			activeTeam: "red",
			serverNow: 1700000000000,
			timeLimit: 600,
			timeIncrement: 0
		})

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({
				gameId: "game-1",
				newFen: INITIAL_FEN_BLACK_TOP,
				capturePiece: null,
				team: "red"
			})

		expect(res.status).toBe(400)
		expect(res.body).toMatchObject({
			success: false,
			message: "move-piece.messages.time-expired",
			status_code: 400
		})
		expect(armClockMock).toHaveBeenCalledWith("game-1")
		expect(insertOneMock).not.toHaveBeenCalled()
	})

	it("returns 201 and inserts a new history record without capture", async () => {
		const accessToken = buildAccessToken(91, "session-move-piece-6")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 91 }))
		toArrayMock.mockResolvedValue([
			{ _id: { toString: () => "mongo-id-prev" }, game_id: "game-1", fen: INITIAL_FEN_BLACK_TOP, team: "red" }
		])
		insertOneMock.mockResolvedValue({
			insertedId: { toString: () => "mongo-id-new" }
		})

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({
				gameId: "game-1",
				newFen: INITIAL_FEN_BLACK_TOP,
				capturePiece: null,
				team: "red"
			})

		expect(res.status).toBe(201)
		expect(insertOneMock).toHaveBeenCalledWith(
			expect.objectContaining({
				game_id: "game-1",
				fen: `${INITIAL_FEN_BLACK_TOP} b - - 1 1`,
				team: "black",
				time_stamp: expect.any(Number)
			})
		)
		expect(res.body).toMatchObject({
			success: true,
			message: "move-piece.messages.success",
			status_code: 201,
			data: {
				_id: "mongo-id-new",
				game_id: "game-1",
				fen: `${INITIAL_FEN_BLACK_TOP} b - - 1 1`,
				team: "black"
			}
		})
		// Should not have capture field when no piece is captured
		expect(res.body.data).not.toHaveProperty("capture")
	})

	it("returns 201 and inserts a new history record with capture as uppercase for red team", async () => {
		const accessToken = buildAccessToken(91, "session-move-piece-6-capture")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 91 }))
		toArrayMock.mockResolvedValue([
			{ _id: { toString: () => "mongo-id-prev" }, game_id: "game-1", fen: INITIAL_FEN_BLACK_TOP, team: "red" }
		])
		insertOneMock.mockResolvedValue({
			insertedId: { toString: () => "mongo-id-new" }
		})

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({
				gameId: "game-1",
				newFen: INITIAL_FEN_BLACK_TOP,
				capturePiece: "r",
				team: "red"
			})

		expect(res.status).toBe(201)
		expect(insertOneMock).toHaveBeenCalledWith(
			expect.objectContaining({
				game_id: "game-1",
				fen: `${INITIAL_FEN_BLACK_TOP} b - - 0 1`,
				team: "black",
				capture: "R",
				time_stamp: expect.any(Number)
			})
		)
		expect(res.body).toMatchObject({
			success: true,
			message: "move-piece.messages.success",
			status_code: 201,
			data: {
				_id: "mongo-id-new",
				game_id: "game-1",
				fen: `${INITIAL_FEN_BLACK_TOP} b - - 0 1`,
				team: "black",
				capture: "R"
			}
		})
	})

	it("returns 201 and inserts a new history record with capture as lowercase for black team", async () => {
		const accessToken = buildAccessToken(91, "session-move-piece-6-capture-black")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 91 }))
		toArrayMock.mockResolvedValue([
			{ _id: { toString: () => "mongo-id-prev" }, game_id: "game-1", fen: INITIAL_FEN_BLACK_TOP, team: "black" }
		])
		insertOneMock.mockResolvedValue({
			insertedId: { toString: () => "mongo-id-new" }
		})

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({
				gameId: "game-1",
				newFen: INITIAL_FEN_BLACK_TOP,
				capturePiece: "R",
				team: "black"
			})

		expect(res.status).toBe(201)
		expect(insertOneMock).toHaveBeenCalledWith(
			expect.objectContaining({
				game_id: "game-1",
				fen: `${INITIAL_FEN_BLACK_TOP} w - - 0 2`,
				team: "red",
				capture: "r",
				time_stamp: expect.any(Number)
			})
		)
		expect(res.body).toMatchObject({
			success: true,
			message: "move-piece.messages.success",
			status_code: 201,
			data: {
				_id: "mongo-id-new",
				game_id: "game-1",
				fen: `${INITIAL_FEN_BLACK_TOP} w - - 0 2`,
				team: "red",
				capture: "r"
			}
		})
	})

	it("resets the half-move clock to 0 when a soldier advances forward", async () => {
		const accessToken = buildAccessToken(91, "session-move-piece-soldier-advance")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 91 }))
		// Prev clock at 5; red soldier on row 6 about to step forward to row 5.
		toArrayMock.mockResolvedValue([
			{
				_id: { toString: () => "mongo-id-prev" },
				game_id: "game-1",
				fen: "4G4/9/9/9/9/9/s8/9/9/4g4 w - - 5 3",
				team: "red"
			}
		])
		insertOneMock.mockResolvedValue({ insertedId: { toString: () => "mongo-id-new" } })

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({
				gameId: "game-1",
				newFen: "4G4/9/9/9/9/s8/9/9/9/4g4",
				capturePiece: null,
				team: "red"
			})

		expect(res.status).toBe(201)
		expect(insertOneMock).toHaveBeenCalledWith(
			expect.objectContaining({
				game_id: "game-1",
				fen: "4G4/9/9/9/9/s8/9/9/9/4g4 b - - 0 3",
				team: "black"
			})
		)
	})

	it("keeps counting when a soldier only shifts sideways (no forward progress)", async () => {
		const accessToken = buildAccessToken(91, "session-move-piece-soldier-sideways")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 91 }))
		// Prev clock at 5; red soldier already across the river shuffles sideways.
		toArrayMock.mockResolvedValue([
			{
				_id: { toString: () => "mongo-id-prev" },
				game_id: "game-1",
				fen: "4G4/9/9/s8/9/9/9/9/9/4g4 w - - 5 3",
				team: "red"
			}
		])
		insertOneMock.mockResolvedValue({ insertedId: { toString: () => "mongo-id-new" } })

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({
				gameId: "game-1",
				newFen: "4G4/9/9/1s7/9/9/9/9/9/4g4",
				capturePiece: null,
				team: "red"
			})

		expect(res.status).toBe(201)
		// Sideways is not progress -> the clock advances from 5 to 6.
		expect(insertOneMock).toHaveBeenCalledWith(
			expect.objectContaining({
				game_id: "game-1",
				fen: "4G4/9/9/1s7/9/9/9/9/9/4g4 b - - 6 3",
				team: "black"
			})
		)
	})

	it("returns 400 when team does not match latest history record", async () => {
		const accessToken = buildAccessToken(91, "session-move-piece-invalid-team")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 91 }))
		toArrayMock.mockResolvedValue([
			{ _id: { toString: () => "mongo-id-prev" }, game_id: "game-1", fen: INITIAL_FEN_BLACK_TOP, team: "red" }
		])

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({
				gameId: "game-1",
				newFen: INITIAL_FEN_BLACK_TOP,
				capturePiece: null,
				team: "black"
			})

		expect(res.status).toBe(400)
		expect(res.body).toMatchObject({
			success: false,
			message: "move-piece.messages.invalid-team",
			status_code: 400
		})
		expect(insertOneMock).not.toHaveBeenCalled()
	})

	it("returns 500 when database throws unexpected error", async () => {
		const accessToken = buildAccessToken(91, "session-move-piece-7")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 91 }))
		consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined)
		getGameHistoryCollectionMock.mockRejectedValue(new Error("mongo down"))

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({
				gameId: "game-1",
				newFen: INITIAL_FEN_BLACK_TOP,
				capturePiece: null,
				team: "red"
			})

		expect(res.status).toBe(500)
		expect(res.body).toMatchObject({
			success: false,
			message: "move-piece.messages.internal-server-error",
			status_code: 500
		})
	})
})
