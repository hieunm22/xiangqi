import express from "express"
import jwt from "jsonwebtoken"
import request from "supertest"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"

const redisGetMock = vi.fn()
const roomFindUniqueMock = vi.fn()
const roomUserFindUniqueMock = vi.fn()
const updateManyMock = vi.fn()
const getChatMessageCollectionMock = vi.fn()

const PATH = "/api/message/mark-room-as-read"

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
		}
	}
}))

vi.mock("../../common/mongodb", () => ({
	getChatMessageCollection: getChatMessageCollectionMock
}))

describe("POST /api/message/mark-room-as-read", () => {
	let app: express.Express
	let consoleErrorSpy: ReturnType<typeof vi.spyOn>

	beforeAll(async () => {
		process.env.JWT_SECRET = "unit-test-secret"
		process.env.JWT_ISSUER = "unit-test-issuer"

		const { default: markRoomAsReadRoutes } = await import("./mark-room-as-read")
		app = express()
		app.use(express.json())
		app.use("/api", markRoomAsReadRoutes)
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
		const res = await request(app).post(PATH).send({ room_id: 101 })

		expect(res.status).toBe(401)
		expect(res.body).toMatchObject({
			success: false,
			message: "auth-middleware.messages.token-required",
			status_code: 401
		})
		expect(roomFindUniqueMock).not.toHaveBeenCalled()
	})

	it("returns 400 when room_id is invalid", async () => {
		const accessToken = buildAccessToken(1, "session-mark-room-1")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 1 }))

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({ room_id: 0 })

		expect(res.status).toBe(400)
		expect(res.body).toMatchObject({
			success: false,
			message: "Invalid room_id",
			status_code: 400
		})
	})

	it("returns 404 when room does not exist or is inactive", async () => {
		const accessToken = buildAccessToken(1, "session-mark-room-2")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 1 }))
		roomFindUniqueMock.mockResolvedValue(null)

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({ room_id: 101 })

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
		const accessToken = buildAccessToken(1, "session-mark-room-3")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 1 }))
		roomFindUniqueMock.mockResolvedValue({ id: 101n })
		roomUserFindUniqueMock.mockResolvedValue(null)

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({ room_id: 101 })

		expect(res.status).toBe(403)
		expect(res.body).toMatchObject({
			success: false,
			message: "Forbidden",
			status_code: 403
		})
	})

	it("returns 200 and marks only messages sent after joined_at", async () => {
		const accessToken = buildAccessToken(78, "session-mark-room-4")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 78 }))
		roomFindUniqueMock.mockResolvedValue({ id: 101n })
		const joinedAt = new Date("2026-07-03T02:17:26.345Z")
		roomUserFindUniqueMock.mockResolvedValue({ room_id: 101n, joined_at: joinedAt })

		updateManyMock.mockResolvedValue({ modifiedCount: 1 })
		getChatMessageCollectionMock.mockResolvedValue({ updateMany: updateManyMock })

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({ room_id: 101 })

		expect(res.status).toBe(200)
		expect(res.body).toMatchObject({
			success: true,
			message: "All messages marked as read",
			status_code: 200
		})
		expect(roomUserFindUniqueMock).toHaveBeenCalledWith({
			where: {
				room_id_user_id: {
					room_id: 101n,
					user_id: 78n
				}
			},
			select: { room_id: true, joined_at: true }
		})
		expect(updateManyMock).toHaveBeenCalledWith(
			{
				room_id: 101,
				timestamp: { $gt: joinedAt }
			},
			{
				$addToSet: { read_by: 78 }
			}
		)
	})

	it("returns 500 when mongodb update fails", async () => {
		const accessToken = buildAccessToken(1, "session-mark-room-5")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 1 }))
		roomFindUniqueMock.mockResolvedValue({ id: 101n })
		roomUserFindUniqueMock.mockResolvedValue({ room_id: 101n, joined_at: new Date() })
		consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined)
		getChatMessageCollectionMock.mockRejectedValue(new Error("mongo down"))

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({ room_id: 101 })

		expect(res.status).toBe(500)
		expect(res.body).toMatchObject({
			success: false,
			message: "Internal server error",
			status_code: 500
		})
	})
})
