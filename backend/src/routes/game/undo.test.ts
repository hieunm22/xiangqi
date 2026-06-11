import express from "express"
import jwt from "jsonwebtoken"
import { ObjectId } from "mongodb"
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

const redisGetMock = vi.fn()
const gameFindUniqueMock = vi.fn()
const roomUserFindUniqueMock = vi.fn()
const toArrayMock = vi.fn()
const findMock = vi.fn()
const deleteManyMock = vi.fn()
const updateOneMock = vi.fn()
const getGameHistoryCollectionMock = vi.fn()
const getIOMock = vi.fn()

const PATH = "/api/game/undo"

vi.mock("../../common/redis", () => ({
	default: {
		get: redisGetMock
	}
}))

vi.mock("prisma", () => ({
	default: {
		game: {
			findUnique: gameFindUniqueMock
		},
		roomUser: {
			findUnique: roomUserFindUniqueMock
		}
	}
}))

vi.mock("../../common/mongodb", () => ({
	getGameHistoryCollection: getGameHistoryCollectionMock
}))

vi.mock("../../common/socket", () => ({
	getIO: getIOMock
}))

describe("POST /api/game/undo", () => {
	let app: express.Express

	beforeAll(async () => {
		process.env.JWT_SECRET = "unit-test-secret"
		process.env.JWT_ISSUER = "unit-test-issuer"

		const { default: undoRoutes } = await import("./undo")
		app = express()
		app.use(express.json())
		app.use("/api", undoRoutes)
	})

	beforeEach(() => {
		// Simple mock: find() returns an object with toArray() method
		findMock.mockReturnValue({
			toArray: toArrayMock
		})

		getGameHistoryCollectionMock.mockResolvedValue({
			find: findMock,
			deleteMany: deleteManyMock,
			updateOne: updateOneMock
		})
		getIOMock.mockReturnValue({
			to: vi.fn().mockReturnValue({
				emit: vi.fn()
			})
		})
	})

	afterEach(() => {
		vi.clearAllMocks()
	})

	const buildAccessToken = (userId: number, sessionId: string) =>
		jwt.sign({ sub: userId, jti: sessionId }, process.env.JWT_SECRET as string, {
			issuer: process.env.JWT_ISSUER,
			expiresIn: "1h"
		})

	it("returns 401 when authorization token is missing", async () => {
		const res = await request(app).post(PATH).send({
			gameId: "game-1"
		})

		expect(res.status).toBe(401)
		expect(res.body).toMatchObject({
			success: false,
			message: "auth-middleware.messages.token-required",
			status_code: 401
		})
	})

	it("returns 400 when gameId is invalid", async () => {
		const accessToken = buildAccessToken(1, "session-undo-1")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 1 }))

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({
				gameId: 123
			})

		expect(res.status).toBe(400)
		expect(res.body).toMatchObject({
			success: false,
			message: "undo.messages.invalid-game-id",
			status_code: 400
		})
	})

	it("returns 400 when gameId is missing", async () => {
		const accessToken = buildAccessToken(1, "session-undo-2")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 1 }))

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({})

		expect(res.status).toBe(400)
		expect(res.body).toMatchObject({
			success: false,
			message: "undo.messages.invalid-game-id",
			status_code: 400
		})
	})

	it("returns 400 when game not found", async () => {
		const accessToken = buildAccessToken(1, "session-undo-3")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 1 }))
		gameFindUniqueMock.mockResolvedValue(null)

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({
				gameId: "nonexistent-game"
			})

		expect(res.status).toBe(400)
		expect(res.body).toMatchObject({
			success: false,
			message: "undo.messages.game-not-found",
			status_code: 400
		})
	})

	it("returns 403 when user is not in game", async () => {
		const accessToken = buildAccessToken(1, "session-undo-4")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 1 }))
		gameFindUniqueMock.mockResolvedValue({
			id: "game-1",
			room_id: BigInt(1),
			game_users: [{ user_id: BigInt(2) }]
		})

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({
				gameId: "game-1"
			})

		expect(res.status).toBe(403)
		expect(res.body).toMatchObject({
			success: false,
			message: "undo.messages.not-in-game",
			status_code: 403
		})
	})

	it("returns 403 when user is not in room", async () => {
		const accessToken = buildAccessToken(1, "session-undo-5")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 1 }))
		gameFindUniqueMock.mockResolvedValue({
			id: "game-1",
			room_id: BigInt(1),
			game_users: [{ user_id: BigInt(1) }]
		})
		roomUserFindUniqueMock.mockResolvedValue(null)

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({
				gameId: "game-1"
			})

		expect(res.status).toBe(403)
		expect(res.body).toMatchObject({
			success: false,
			message: "undo.messages.not-in-room",
			status_code: 403
		})
	})

	it("returns 403 when user is spectator", async () => {
		const accessToken = buildAccessToken(1, "session-undo-6")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 1 }))
		gameFindUniqueMock.mockResolvedValue({
			id: "game-1",
			room_id: BigInt(1),
			game_users: [{ user_id: BigInt(1) }]
		})
		roomUserFindUniqueMock.mockResolvedValue({
			team: null
		})

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({
				gameId: "game-1"
			})

		expect(res.status).toBe(403)
		expect(res.body).toMatchObject({
			success: false,
			message: "undo.messages.spectator-cannot-undo",
			status_code: 403
		})
	})

	it("returns 400 when no moves to undo", async () => {
		const accessToken = buildAccessToken(1, "session-undo-7")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 1 }))
		gameFindUniqueMock.mockResolvedValue({
			id: "game-1",
			room_id: BigInt(1),
			game_users: [{ user_id: BigInt(1) }]
		})
		roomUserFindUniqueMock.mockResolvedValue({
			team: "red"
		})
		toArrayMock.mockResolvedValue([])

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({
				gameId: "game-1"
			})

		expect(res.status).toBe(400)
		expect(res.body).toMatchObject({
			success: false,
			message: "undo.messages.no-moves",
			status_code: 400
		})
	})

	it("successfully undoes 2 moves when current user made the last move", async () => {
		const gameId = "game-1"
		const accessToken = buildAccessToken(1, "session-undo-8")
		const mockId = new ObjectId()
		const oldMockId = new ObjectId()

		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 1 }))
		gameFindUniqueMock.mockResolvedValue({
			id: gameId,
			room_id: BigInt(1),
			game_users: [{ user_id: BigInt(1) }]
		})
		roomUserFindUniqueMock.mockResolvedValue({
			team: "red"
		})
		// Mock: get all game histories (API fetches all histories once)
		toArrayMock.mockResolvedValueOnce([
			{
				_id: mockId,
				game_id: gameId,
				fen: "new-fen",
				team: "red"
			},
			{
				_id: oldMockId,
				game_id: gameId,
				fen: "old-fen",
				team: "red"
			}
		])
		deleteManyMock.mockResolvedValue({ deletedCount: 2 })

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({
				gameId: gameId
			})

		expect(res.status).toBe(200)
		expect(res.body).toMatchObject({
			success: true,
			message: "undo.messages.success",
			status_code: 200,
			data: [
				{
					_id: mockId.toHexString(),
					game_id: gameId,
					fen: "new-fen",
					team: "red"
				},
				{
					_id: oldMockId.toHexString(),
					game_id: gameId,
					fen: "old-fen",
					team: "red"
				}
			]
		})
		expect(updateOneMock).not.toHaveBeenCalled()
	})

	it("successfully undoes 2 moves when opponent made the last move", async () => {
		const gameId = "game-1"
		const accessToken = buildAccessToken(1, "session-undo-9")
		const mockId1 = new ObjectId()
		const mockId2 = new ObjectId()
		const oldMockId = new ObjectId()

		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 1 }))
		gameFindUniqueMock.mockResolvedValue({
			id: gameId,
			room_id: BigInt(1),
			game_users: [{ user_id: BigInt(1) }]
		})
		roomUserFindUniqueMock.mockResolvedValue({
			team: "red"
		})
		// Mock: get all game histories
		toArrayMock.mockResolvedValueOnce([
			{
				_id: mockId1,
				game_id: gameId,
				fen: "latest-fen",
				team: "black"
			},
			{
				_id: mockId2,
				game_id: gameId,
				fen: "opponent-move-fen",
				team: "red"
			},
			{
				_id: oldMockId,
				game_id: gameId,
				fen: "before-opponent-fen",
				team: "black"
			}
		])
		deleteManyMock.mockResolvedValue({ deletedCount: 1 })

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({
				gameId: gameId
			})

		expect(res.status).toBe(200)
		expect(res.body).toMatchObject({
			success: true,
			message: "undo.messages.success",
			status_code: 200,
			data: [
				{
					_id: oldMockId.toHexString(),
					game_id: gameId,
					fen: "before-opponent-fen",
					team: "black"
				}
			]
		})
		expect(updateOneMock).toHaveBeenCalledWith(
			{ _id: mockId2 },
			{ $set: { undo: 1 } }
		)
	})

	it("returns 400 when delete operation fails", async () => {
		const gameId = "game-1"
		const accessToken = buildAccessToken(1, "session-undo-10")
		const mockId = new ObjectId()

		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 1 }))
		gameFindUniqueMock.mockResolvedValue({
			id: gameId,
			room_id: BigInt(1),
			game_users: [{ user_id: BigInt(1) }]
		})
		roomUserFindUniqueMock.mockResolvedValue({
			team: "red"
		})
		// Mock: get all game histories
		toArrayMock.mockResolvedValueOnce([
			{
				_id: mockId,
				game_id: gameId,
				fen: "new-fen",
				team: "black"
			}
		])
		deleteManyMock.mockResolvedValue({ deletedCount: 0 })

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({
				gameId: gameId
			})

		expect(res.status).toBe(400)
		expect(res.body).toMatchObject({
			success: false,
			message: "undo.messages.delete-failed",
			status_code: 400
		})
	})

	it("returns 400 when undo limit exceeded (max 3 per game)", async () => {
		const gameId = "game-1"
		const accessToken = buildAccessToken(1, "session-undo-11")
		const mockId1 = new ObjectId()
		const mockId2 = new ObjectId()
		const mockId3 = new ObjectId()
		const mockId4 = new ObjectId()

		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 1 }))
		gameFindUniqueMock.mockResolvedValue({
			id: gameId,
			room_id: BigInt(1),
			game_users: [{ user_id: BigInt(1) }]
		})
		roomUserFindUniqueMock.mockResolvedValue({
			team: "red"
		})
		// Mock: get all game histories with 3 undo records for user 1
		toArrayMock.mockResolvedValueOnce([
			{
				_id: mockId1,
				game_id: gameId,
				fen: "fen-1",
				team: "red",
				undo: 1
			},
			{
				_id: mockId2,
				game_id: gameId,
				fen: "fen-2",
				team: "black",
				undo: 1
			},
			{
				_id: mockId3,
				game_id: gameId,
				fen: "fen-3",
				team: "red",
				undo: 1
			},
			{
				_id: mockId4,
				game_id: gameId,
				fen: "fen-4",
				team: "black"
			}
		])

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({
				gameId: gameId
			})

		expect(res.status).toBe(400)
		expect(res.body).toMatchObject({
			success: false,
			message: "undo.messages.undo-limit-exceeded",
			status_code: 400
		})
	})

	it("verifies undo field is added to remaining record after delete", async () => {
		const gameId = "game-1"
		const accessToken = buildAccessToken(1, "session-undo-12")
		const mockId = new ObjectId()
		const oldMockId = new ObjectId()

		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 1 }))
		gameFindUniqueMock.mockResolvedValue({
			id: gameId,
			room_id: BigInt(1),
			game_users: [{ user_id: BigInt(1) }]
		})
		roomUserFindUniqueMock.mockResolvedValue({
			team: "red"
		})
		// Mock: get all game histories with 1 existing undo for user 1
		toArrayMock.mockResolvedValueOnce([
			{
				_id: mockId,
				game_id: gameId,
				fen: "new-fen",
				team: "red"
			},
			{
				_id: oldMockId,
				game_id: gameId,
				fen: "old-fen",
				team: "black",
				undo: 1
			}
		])
		deleteManyMock.mockResolvedValue({ deletedCount: 1 })

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({
				gameId: gameId
			})

		expect(res.status).toBe(200)
		expect(updateOneMock).toHaveBeenCalledWith(
			{ _id: mockId },
			{ $set: { undo: 1 } }
		)
	})
})
