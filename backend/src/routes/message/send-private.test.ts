import express from "express"
import jwt from "jsonwebtoken"
import request from "supertest"
import { ObjectId } from "mongodb"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"

const redisGetMock = vi.fn()
const userFindUniqueMock = vi.fn()
const insertOneMock = vi.fn()
const getChatMessageCollectionMock = vi.fn()

const PATH = "/api/message/send-private"

vi.mock("../../common/redis", () => ({
	default: {
		get: redisGetMock
	}
}))

vi.mock("prisma", () => ({
	default: {
		user: {
			findUnique: userFindUniqueMock
		}
	}
}))

vi.mock("../../common/mongodb", () => ({
	getChatMessageCollection: getChatMessageCollectionMock
}))

describe("POST /api/message/send-private", () => {
	let app: express.Express
	let consoleErrorSpy: ReturnType<typeof vi.spyOn>

	beforeAll(async () => {
		process.env.JWT_SECRET = "unit-test-secret"
		process.env.JWT_ISSUER = "unit-test-issuer"

		const { default: sendPrivateRoutes } = await import("./send-private")
		app = express()
		app.use(express.json())
		app.use("/api", sendPrivateRoutes)
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
			message: "Hello",
			receiver_id: 2
		})

		expect(res.status).toBe(401)
		expect(res.body).toMatchObject({
			success: false,
			message: "auth-middleware.messages.token-required",
			status_code: 401
		})
		expect(userFindUniqueMock).not.toHaveBeenCalled()
	})

	it("returns 400 when message is empty", async () => {
		const accessToken = buildAccessToken(1, "session-send-1")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 1 }))

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({
				message: "",
				receiver_id: 2
			})

		expect(res.status).toBe(400)
		expect(res.body).toMatchObject({
			success: false,
			message: "Invalid message",
			status_code: 400
		})
		expect(userFindUniqueMock).not.toHaveBeenCalled()
	})

	it("returns 400 when receiver_id is invalid", async () => {
		const accessToken = buildAccessToken(1, "session-send-2")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 1 }))

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({
				message: "Hello",
				receiver_id: 0
			})

		expect(res.status).toBe(400)
		expect(res.body).toMatchObject({
			success: false,
			message: "Invalid receiver_id",
			status_code: 400
		})
		expect(userFindUniqueMock).not.toHaveBeenCalled()
	})

	it("returns 400 when sender tries to send message to themselves", async () => {
		const accessToken = buildAccessToken(1, "session-send-3")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 1 }))

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({
				message: "Hello",
				receiver_id: 1
			})

		expect(res.status).toBe(400)
		expect(res.body).toMatchObject({
			success: false,
			message: "Cannot send message to yourself",
			status_code: 400
		})
		expect(userFindUniqueMock).not.toHaveBeenCalled()
	})

	it("returns 400 when receiver does not exist", async () => {
		const accessToken = buildAccessToken(1, "session-send-4")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 1 }))
		userFindUniqueMock.mockResolvedValue(null)

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({
				message: "Hello",
				receiver_id: 999
			})

		expect(res.status).toBe(400)
		expect(res.body).toMatchObject({
			success: false,
			message: "Receiver not found",
			status_code: 400
		})
		expect(userFindUniqueMock).toHaveBeenCalledWith({
			where: { id: 999n },
			select: { id: true }
		})
	})

	it("returns 201 and saves message successfully", async () => {
		const accessToken = buildAccessToken(1, "session-send-5")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 1 }))
		// First call: check receiver exists; second call: get sender info
		userFindUniqueMock
			.mockResolvedValueOnce({ id: 2, display_name: "User 2" })
			.mockResolvedValueOnce({ id: BigInt(1), display_name: "User 1", avatar_seq: 0 })

		const messageId = new ObjectId()
		insertOneMock.mockResolvedValue({ insertedId: messageId })
		getChatMessageCollectionMock.mockResolvedValue({ insertOne: insertOneMock })

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({
				message: "Hello from user 1",
				receiver_id: 2
			})

		expect(res.status).toBe(201)
		expect(res.body).toMatchObject({
			success: true,
			message: "Success",
			status_code: 201,
			data: {
				message: "Hello from user 1",
				sender: expect.objectContaining({ id: 1 }),
				receiver_id: 2,
				seen: false
			}
		})
		expect(insertOneMock).toHaveBeenCalledWith(
			expect.objectContaining({
				type: "private",
				message: "Hello from user 1",
				sender_id: 1,
				receiver_id: 2,
				conversation_key: "1_2",
				seen: false
			})
		)
	})

	it("returns 201 with conversation_key min_max format", async () => {
		const accessToken = buildAccessToken(5, "session-send-6")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 5 }))
		userFindUniqueMock.mockResolvedValue({ id: 3, display_name: "User 3" })

		const messageId = new ObjectId()
		insertOneMock.mockResolvedValue({ insertedId: messageId })
		getChatMessageCollectionMock.mockResolvedValue({ insertOne: insertOneMock })

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({
				message: "Hi",
				receiver_id: 3
			})

		expect(res.status).toBe(201)
		// conversation_key should be min_id_max_id
		expect(insertOneMock).toHaveBeenCalledWith(
			expect.objectContaining({
				conversation_key: "3_5" // min=3, max=5
			})
		)
	})

	it("returns 500 when mongo insert fails", async () => {
		const accessToken = buildAccessToken(1, "session-send-7")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 1 }))
		consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined)
		userFindUniqueMock.mockResolvedValue({ id: 2, display_name: "User 2" })
		getChatMessageCollectionMock.mockRejectedValue(new Error("mongo down"))

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({
				message: "Hello",
				receiver_id: 2
			})

		expect(res.status).toBe(500)
		expect(res.body).toMatchObject({
			success: false,
			message: "Internal server error",
			status_code: 500
		})
	})
})
