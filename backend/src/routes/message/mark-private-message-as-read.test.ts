import express from "express"
import jwt from "jsonwebtoken"
import request from "supertest"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"

const redisGetMock = vi.fn()
const userFindUniqueMock = vi.fn()
const updateManyMock = vi.fn()
const getChatMessageCollectionMock = vi.fn()

const PATH = "/api/message/mark-private-message-as-read"

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

describe("POST /api/message/mark-private-message-as-read", () => {
	let app: express.Express
	let consoleErrorSpy: ReturnType<typeof vi.spyOn>

	beforeAll(async () => {
		process.env.JWT_SECRET = "unit-test-secret"
		process.env.JWT_ISSUER = "unit-test-issuer"

		const { default: markReadRoutes } = await import("./mark-private-message-as-read")
		app = express()
		app.use(express.json())
		app.use("/api", markReadRoutes)
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

	it("returns 400 when receiver_id is missing", async () => {
		const accessToken = buildAccessToken(1, "session-mark-1")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 1 }))

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({})

		expect(res.status).toBe(400)
		expect(res.body).toMatchObject({
			success: false,
			message: "Invalid receiver_id",
			status_code: 400
		})
		expect(userFindUniqueMock).not.toHaveBeenCalled()
	})

	it("returns 400 when receiver_id is invalid", async () => {
		const accessToken = buildAccessToken(1, "session-mark-2")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 1 }))

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({
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

	it("returns 400 when receiver does not exist", async () => {
		const accessToken = buildAccessToken(1, "session-mark-3")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 1 }))
		userFindUniqueMock.mockResolvedValue(null)

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({
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

	it("returns 200 and marks messages as read successfully", async () => {
		const accessToken = buildAccessToken(1, "session-mark-4")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 1 }))
		userFindUniqueMock.mockResolvedValue({ id: 2, display_name: "User 2" })

		updateManyMock.mockResolvedValue({ modifiedCount: 3 })
		getChatMessageCollectionMock.mockResolvedValue({ updateMany: updateManyMock })

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({
				receiver_id: 2
			})

		expect(res.status).toBe(200)
		expect(res.body).toMatchObject({
			success: true,
			message: "All messages marked as read",
			status_code: 200
		})
		// Verify that updateMany was called with correct query to mark messages as read
		// Query: messages FROM receiver_id (2) TO current user (1) that are unseen
		expect(updateManyMock).toHaveBeenCalledWith(
			{
				sender_id: 2,
				receiver_id: 1,
				seen: { $ne: true }
			},
			{
				$set: { seen: true }
			}
		)
	})

	it("marks only unread messages (seen: false) as seen (seen: true)", async () => {
		const accessToken = buildAccessToken(3, "session-mark-5")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 3 }))
		userFindUniqueMock.mockResolvedValue({ id: 5, display_name: "User 5" })

		updateManyMock.mockResolvedValue({ modifiedCount: 2 })
		getChatMessageCollectionMock.mockResolvedValue({ updateMany: updateManyMock })

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({
				receiver_id: 5
			})

		expect(res.status).toBe(200)
		// Verify the query only targets unseen messages (unread)
		expect(updateManyMock).toHaveBeenCalledWith(
			{
				sender_id: 5,
				receiver_id: 3,
				seen: { $ne: true }
			},
			{
				$set: { seen: true }
			}
		)
	})

	it("returns 500 when mongo update fails", async () => {
		const accessToken = buildAccessToken(1, "session-mark-6")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 1 }))
		consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined)
		userFindUniqueMock.mockResolvedValue({ id: 2, display_name: "User 2" })
		getChatMessageCollectionMock.mockRejectedValue(new Error("mongo down"))

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({
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
