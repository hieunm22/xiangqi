import express from "express"
import jwt from "jsonwebtoken"
import request from "supertest"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import { INITIAL_FEN_BLACK_TOP, INITIAL_FEN_BLACK_BOTTOM } from "common/constant"

const redisGetMock = vi.fn()
const transactionMock = vi.fn()
const roomUpdateMock = vi.fn()
const gameCreateMock = vi.fn()
const gameHistoryInsertOneMock = vi.fn()
const getGameHistoryCollectionMock = vi.fn()
const roomFindUniqueMock = vi.fn()

const PATH = "/api/room/start"

vi.mock("../../common/redis", () => ({
	default: {
		get: redisGetMock
	}
}))

vi.mock("prisma", () => ({
	default: {
		room: {
			findUnique: roomFindUniqueMock
		},
		$transaction: transactionMock
	}
}))

vi.mock("../../common/mongodb", () => ({
	getGameHistoryCollection: getGameHistoryCollectionMock
}))

describe("POST /api/room/start", () => {
	let app: express.Express
	let consoleErrorSpy: ReturnType<typeof vi.spyOn>

	beforeAll(async () => {
		process.env.JWT_SECRET = "unit-test-secret"
		process.env.JWT_ISSUER = "unit-test-issuer"

		const { default: startGameRoutes } = await import("./start-game")
		app = express()
		app.use(express.json())
		app.use("/api", startGameRoutes)
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
		const res = await request(app).post(PATH).send({ id: 101 })

		expect(res.status).toBe(401)
		expect(res.body).toMatchObject({
			success: false,
			message: "auth-middleware.messages.token-required",
			status_code: 401
		})
	})

	it("returns 400 when roomId is invalid", async () => {
		const accessToken = buildAccessToken(61, "session-start-1")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 61 }))

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({ id: "abc" })

		expect(res.status).toBe(400)
		expect(res.body).toMatchObject({
			success: false,
			message: "start-game.messages.invalid-room-id",
			status_code: 400
		})
		expect(transactionMock).not.toHaveBeenCalled()
		expect(roomFindUniqueMock).not.toHaveBeenCalled()
	})

	it("returns 201 when game is started successfully", async () => {
		const accessToken = buildAccessToken(61, "session-start-2")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 61 }))
		gameHistoryInsertOneMock.mockResolvedValue({ insertedId: "mongo-id-1" })
		roomFindUniqueMock.mockResolvedValue({ id: BigInt(101) })
		getGameHistoryCollectionMock.mockResolvedValue({
			insertOne: gameHistoryInsertOneMock
		})

		roomUpdateMock.mockResolvedValue({
			id: BigInt(101),
			status: 2,
			red_first: true
		})
		gameCreateMock.mockResolvedValue({
			id: "c5afe4a6-48fd-47de-ac7e-1f635f859919",
			status: 1,
			bot_difficulty: null,
			room_id: BigInt(101)
		})
		transactionMock.mockImplementation(async callback =>
			callback({
				room: {
					update: roomUpdateMock
				},
				game: {
					create: gameCreateMock
				}
			})
		)

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({ id: 101 })

		expect(res.status).toBe(201)
		expect(res.body).toMatchObject({
			success: true,
			message: "start-game.messages.success",
			status_code: 201,
			data: {
				game: {
					id: "c5afe4a6-48fd-47de-ac7e-1f635f859919",
					status: 1,
					room_id: 101
				},
				room: {
					id: 101,
					status: 2
				}
			}
		})

		expect(roomUpdateMock).toHaveBeenCalledWith({
			where: { id: BigInt(101) },
			data: { status: 2 },
			select: {
				id: true,
				status: true,
				red_first: true
			}
		})
		expect(gameCreateMock).toHaveBeenCalledWith({
			data: {
				status: 1,
				bot_difficulty: null,
				room_id: BigInt(101)
			},
			select: {
				id: true,
				status: true,
				bot_difficulty: true,
				room_id: true
			}
		})
		expect(gameHistoryInsertOneMock).toHaveBeenCalledWith({
			game_id: "c5afe4a6-48fd-47de-ac7e-1f635f859919",
			team: "red",
			fen: INITIAL_FEN_BLACK_TOP,
			time_stamp: expect.any(Number)
		})
	})

	it("stores lowercase fen when red_first is false", async () => {
		const accessToken = buildAccessToken(61, "session-start-2b")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 61 }))
		gameHistoryInsertOneMock.mockResolvedValue({ insertedId: "mongo-id-2" })
		roomFindUniqueMock.mockResolvedValue({ id: BigInt(102) })
		getGameHistoryCollectionMock.mockResolvedValue({
			insertOne: gameHistoryInsertOneMock
		})

		roomUpdateMock.mockResolvedValue({
			id: BigInt(102),
			status: 2,
			red_first: false
		})
		gameCreateMock.mockResolvedValue({
			id: "d8d18f53-95f8-4e30-b834-f4b5adce4f22",
			status: 1,
			bot_difficulty: null,
			room_id: BigInt(102)
		})
		transactionMock.mockImplementation(async callback =>
			callback({
				room: {
					update: roomUpdateMock
				},
				game: {
					create: gameCreateMock
				}
			})
		)

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({ id: 102 })

		expect(res.status).toBe(201)
		expect(gameHistoryInsertOneMock).toHaveBeenCalledWith({
			game_id: "d8d18f53-95f8-4e30-b834-f4b5adce4f22",
			team: "black",
			fen: INITIAL_FEN_BLACK_BOTTOM,
			time_stamp: expect.any(Number)
		})
	})

	it("returns 404 when room is not found", async () => {
		const accessToken = buildAccessToken(61, "session-start-3")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 61 }))
		roomFindUniqueMock.mockResolvedValue(null)

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({ id: 999 })

		expect(res.status).toBe(404)
		expect(res.body).toMatchObject({
			success: false,
			message: "start-game.messages.room-not-found",
			status_code: 404
		})
		expect(roomFindUniqueMock).toHaveBeenCalledWith({
			where: { id: BigInt(999) },
			select: { id: true }
		})
		expect(transactionMock).not.toHaveBeenCalled()
	})

	it("returns 500 when unexpected error happens", async () => {
		const accessToken = buildAccessToken(61, "session-start-4")
		consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined)
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 61 }))
		roomFindUniqueMock.mockResolvedValue({ id: BigInt(101) })
		transactionMock.mockRejectedValue(new Error("db down"))

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({ id: 101 })

		expect(res.status).toBe(500)
		expect(res.body).toMatchObject({
			success: false,
			message: "start-game.messages.internal-server-error",
			status_code: 500
		})
	})
})
