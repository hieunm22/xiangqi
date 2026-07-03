import express from "express"
import jwt from "jsonwebtoken"
import request from "supertest"
import { ObjectId } from "mongodb"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"

const redisGetMock = vi.fn()
const roomFindUniqueMock = vi.fn()
const roomUserFindUniqueMock = vi.fn()
const userFindUniqueMock = vi.fn()
const toArrayMock = vi.fn()
const sortMock = vi.fn()
const findMock = vi.fn()
const getChatMessageCollectionMock = vi.fn()

const PATH = "/api/message/get-room-message"

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
		roomUser: {
			findUnique: roomUserFindUniqueMock
		},
		user: {
			findUnique: userFindUniqueMock
		}
	}
}))

vi.mock("../../common/mongodb", () => ({
	getChatMessageCollection: getChatMessageCollectionMock
}))

describe("GET /api/message/get-room-message", () => {
	let app: express.Express
	let consoleErrorSpy: ReturnType<typeof vi.spyOn>

	beforeAll(async () => {
		process.env.JWT_SECRET = "unit-test-secret"
		process.env.JWT_ISSUER = "unit-test-issuer"

		const { default: getRoomMessageRoutes } = await import("./get-room-message")
		app = express()
		app.use(express.json())
		app.use("/api", getRoomMessageRoutes)
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
		const res = await request(app).get(`${PATH}?roomId=101`)

		expect(res.status).toBe(401)
		expect(res.body).toMatchObject({
			success: false,
			message: "auth-middleware.messages.token-required",
			status_code: 401
		})
		expect(roomFindUniqueMock).not.toHaveBeenCalled()
	})

	it("returns 400 when roomId is invalid", async () => {
		const accessToken = buildAccessToken(1, "session-get-room-1")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 1 }))

		const res = await request(app)
			.get(`${PATH}?roomId=abc`)
			.set("Authorization", `Bearer ${accessToken}`)

		expect(res.status).toBe(400)
		expect(res.body).toMatchObject({
			success: false,
			message: "Invalid roomId",
			status_code: 400
		})
	})

	it("returns 404 when room does not exist or is inactive", async () => {
		const accessToken = buildAccessToken(1, "session-get-room-2")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 1 }))
		roomFindUniqueMock.mockResolvedValue(null)

		const res = await request(app)
			.get(`${PATH}?roomId=101`)
			.set("Authorization", `Bearer ${accessToken}`)

		expect(res.status).toBe(404)
		expect(res.body).toMatchObject({
			success: false,
			message: "Room not found",
			status_code: 404
		})
		expect(roomFindUniqueMock).toHaveBeenCalledWith({
			where: { id: 101n, is_active: true },
			select: { id: true }
		})
	})

	it("returns 403 when user has not joined the room", async () => {
		const accessToken = buildAccessToken(1, "session-get-room-3")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 1 }))
		roomFindUniqueMock.mockResolvedValue({ id: 101n })
		roomUserFindUniqueMock.mockResolvedValue(null)

		const res = await request(app)
			.get(`${PATH}?roomId=101`)
			.set("Authorization", `Bearer ${accessToken}`)

		expect(res.status).toBe(403)
		expect(res.body).toMatchObject({
			success: false,
			message: "Forbidden",
			status_code: 403
		})
	})

	it("returns 200 and room messages sorted by timestamp ascending", async () => {
		const accessToken = buildAccessToken(1, "session-get-room-4")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 1 }))
		roomFindUniqueMock.mockResolvedValue({ id: 101n })
		const joinedAt = new Date("2026-06-15T09:00:00Z")
		roomUserFindUniqueMock.mockResolvedValue({ room_id: 101n, joined_at: joinedAt })

		userFindUniqueMock
			.mockResolvedValueOnce({
				id: 1n,
				display_name: "User1",
				avatar_seq: 1
			})
			.mockResolvedValueOnce({
				id: 2n,
				display_name: "User2",
				avatar_seq: 2
			})

		const messageId1 = new ObjectId()
		const messageId2 = new ObjectId()
		const timestamp1 = new Date("2026-06-15T10:00:00Z")
		const timestamp2 = new Date("2026-06-15T10:30:00Z")

		toArrayMock.mockResolvedValue([
			{
				_id: messageId1,
				room_id: 101,
				sender_id: 1,
				message: "Hello room",
				read_by: [1, 2],
				timestamp: timestamp1
			},
			{
				_id: messageId2,
				room_id: 101,
				sender_id: 2,
				message: "Hi there",
				read_by: [2],
				timestamp: timestamp2
			}
		])
		sortMock.mockReturnValue({ toArray: toArrayMock })
		findMock.mockReturnValue({ sort: sortMock })
		getChatMessageCollectionMock.mockResolvedValue({ find: findMock })

		const res = await request(app)
			.get(`${PATH}?roomId=101`)
			.set("Authorization", `Bearer ${accessToken}`)

		expect(res.status).toBe(200)
		expect(findMock).toHaveBeenCalledWith({ room_id: 101 })
		expect(sortMock).toHaveBeenCalledWith({ timestamp: 1 })
		expect(res.body).toMatchObject({
			success: true,
			message: "Success",
			status_code: 200
		})
		expect(res.body.data).toHaveLength(2)
		expect(res.body.data[0]).toMatchObject({
			_id: messageId1.toString(),
			room_id: 101,
			sender: {
				id: 1,
				display_name: "User1",
				avatar_url: expect.any(String)
			},
			message: "Hello room",
			read_by: [1, 2],
			seen: true,
			timestamp: timestamp1.toISOString()
		})
		expect(res.body.data[1]).toMatchObject({
			_id: messageId2.toString(),
			room_id: 101,
			sender: {
				id: 2,
				display_name: "User2",
				avatar_url: expect.any(String)
			},
			message: "Hi there",
			read_by: [2],
			seen: false,
			timestamp: timestamp2.toISOString()
		})
	})

	it("returns 500 when mongodb query fails", async () => {
		const accessToken = buildAccessToken(1, "session-get-room-5")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 1 }))
		roomFindUniqueMock.mockResolvedValue({ id: 101n })
		roomUserFindUniqueMock.mockResolvedValue({ room_id: 101n })
		consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined)
		getChatMessageCollectionMock.mockRejectedValue(new Error("mongo down"))

		const res = await request(app)
			.get(`${PATH}?roomId=101`)
			.set("Authorization", `Bearer ${accessToken}`)

		expect(res.status).toBe(500)
		expect(res.body).toMatchObject({
			success: false,
			message: "Internal server error",
			status_code: 500
		})
	})

	it("treats messages sent before joined_at as seen", async () => {
		const accessToken = buildAccessToken(1, "session-get-room-6")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 1 }))
		roomFindUniqueMock.mockResolvedValue({ id: 101n })
		const joinedAt = new Date("2026-06-15T10:00:00Z")
		roomUserFindUniqueMock.mockResolvedValue({ room_id: 101n, joined_at: joinedAt })

		userFindUniqueMock
			.mockResolvedValueOnce({
				id: 2n,
				display_name: "User2",
				avatar_seq: 2
			})
			.mockResolvedValueOnce({
				id: 2n,
				display_name: "User2",
				avatar_seq: 2
			})

		const beforeJoinId = new ObjectId()
		const afterJoinId = new ObjectId()
		const beforeJoinTimestamp = new Date("2026-06-15T09:59:59.000Z")
		const afterJoinTimestamp = new Date("2026-06-15T10:00:01.000Z")

		toArrayMock.mockResolvedValue([
			{
				_id: beforeJoinId,
				room_id: 101,
				sender_id: 2,
				message: "Old message",
				read_by: [],
				timestamp: beforeJoinTimestamp
			},
			{
				_id: afterJoinId,
				room_id: 101,
				sender_id: 2,
				message: "New message",
				read_by: [],
				timestamp: afterJoinTimestamp
			}
		])
		sortMock.mockReturnValue({ toArray: toArrayMock })
		findMock.mockReturnValue({ sort: sortMock })
		getChatMessageCollectionMock.mockResolvedValue({ find: findMock })

		const res = await request(app)
			.get(`${PATH}?roomId=101`)
			.set("Authorization", `Bearer ${accessToken}`)

		expect(res.status).toBe(200)
		expect(res.body.data).toHaveLength(2)
		expect(res.body.data[0]).toMatchObject({
			_id: beforeJoinId.toString(),
			seen: true,
			timestamp: beforeJoinTimestamp.toISOString()
		})
		expect(res.body.data[1]).toMatchObject({
			_id: afterJoinId.toString(),
			seen: false,
			timestamp: afterJoinTimestamp.toISOString()
		})
	})
})
