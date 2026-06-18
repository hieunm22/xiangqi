import express from "express"
import jwt from "jsonwebtoken"
import request from "supertest"
import { ObjectId } from "mongodb"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"

const redisGetMock = vi.fn()
const roomFindUniqueMock = vi.fn()
const roomUserFindUniqueMock = vi.fn()
const userFindUniqueMock = vi.fn()
const insertOneMock = vi.fn()
const getChatMessageCollectionMock = vi.fn()

const PATH = "/api/message/send-room-message"

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

describe("POST /api/message/send-room-message", () => {
	let app: express.Express
	let consoleErrorSpy: ReturnType<typeof vi.spyOn>

	beforeAll(async () => {
		process.env.JWT_SECRET = "unit-test-secret"
		process.env.JWT_ISSUER = "unit-test-issuer"

		const { default: sendRoomMessageRoutes } = await import("./send-room-message")
		app = express()
		app.use(express.json())
		app.use("/api", sendRoomMessageRoutes)
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
			room_id: 101,
			message: "Hello"
		})

		expect(res.status).toBe(401)
		expect(res.body).toMatchObject({
			success: false,
			message: "auth-middleware.messages.token-required",
			status_code: 401
		})
		expect(roomFindUniqueMock).not.toHaveBeenCalled()
	})

	it("returns 400 when room_id is invalid", async () => {
		const accessToken = buildAccessToken(1, "session-send-room-1")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 1 }))

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({
				room_id: 0,
				message: "Hello"
			})

		expect(res.status).toBe(400)
		expect(res.body).toMatchObject({
			success: false,
			message: "Invalid room_id",
			status_code: 400
		})
	})

	it("returns 400 when message is invalid", async () => {
		const accessToken = buildAccessToken(1, "session-send-room-2")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 1 }))

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({
				room_id: 101,
				message: ""
			})

		expect(res.status).toBe(400)
		expect(res.body).toMatchObject({
			success: false,
			message: "Invalid message",
			status_code: 400
		})
	})

	it("returns 404 when room does not exist or is inactive", async () => {
		const accessToken = buildAccessToken(1, "session-send-room-3")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 1 }))
		roomFindUniqueMock.mockResolvedValue(null)

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({
				room_id: 101,
				message: "Hello"
			})

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
		const accessToken = buildAccessToken(1, "session-send-room-4")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 1 }))
		roomFindUniqueMock.mockResolvedValue({ id: 101n })
		roomUserFindUniqueMock.mockResolvedValue(null)

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({
				room_id: 101,
				message: "Hello"
			})

		expect(res.status).toBe(403)
		expect(res.body).toMatchObject({
			success: false,
			message: "Forbidden",
			status_code: 403
		})
	})

	it("returns 201 and inserts room message successfully", async () => {
		const accessToken = buildAccessToken(1, "session-send-room-5")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 1 }))
		roomFindUniqueMock.mockResolvedValue({ id: 101n })
		roomUserFindUniqueMock.mockResolvedValue({ room_id: 101n })
		userFindUniqueMock.mockResolvedValue({
			id: 1n,
			display_name: "TestUser",
			avatar_url: "https://example.com/avatar.jpg"
		})

		const insertedId = new ObjectId()
		insertOneMock.mockResolvedValue({ insertedId })
		getChatMessageCollectionMock.mockResolvedValue({ insertOne: insertOneMock })

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({
				room_id: 101,
				message: "Hello room"
			})

		expect(res.status).toBe(201)
		expect(insertOneMock).toHaveBeenCalledWith(
			expect.objectContaining({
				room_id: 101,
				sender_id: 1,
				message: "Hello room",
				timestamp: expect.any(Date)
			})
		)
		expect(res.body).toMatchObject({
			success: true,
			message: "Success",
			status_code: 201,
			data: {
				_id: insertedId.toString(),
				room_id: 101,
				sender: {
					id: 1,
					display_name: "TestUser",
					avatar_url: expect.any(String)
				},
				message: "Hello room"
			}
		})
		expect(typeof res.body.data.timestamp).toBe("string")
	})

	it("returns 500 when mongodb insert fails", async () => {
		const accessToken = buildAccessToken(1, "session-send-room-6")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 1 }))
		roomFindUniqueMock.mockResolvedValue({ id: 101n })
		roomUserFindUniqueMock.mockResolvedValue({ room_id: 101n })
		consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined)
		getChatMessageCollectionMock.mockRejectedValue(new Error("mongo down"))

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({
				room_id: 101,
				message: "Hello"
			})

		expect(res.status).toBe(500)
		expect(res.body).toMatchObject({
			success: false,
			message: "Internal server error",
			status_code: 500
		})
	})
})
