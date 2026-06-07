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
				fen: INITIAL_FEN_BLACK_TOP,
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
				fen: INITIAL_FEN_BLACK_TOP,
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
				fen: INITIAL_FEN_BLACK_TOP,
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
				fen: INITIAL_FEN_BLACK_TOP,
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
				fen: INITIAL_FEN_BLACK_TOP,
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
				fen: INITIAL_FEN_BLACK_TOP,
				team: "red",
				capture: "r"
			}
		})
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
