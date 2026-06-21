import express from "express"
import jwt from "jsonwebtoken"
import request from "supertest"
import { ObjectId } from "mongodb"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"

const redisGetMock = vi.fn()
const userFindUniqueMock = vi.fn()
const insertOneMock = vi.fn()
const getChatMessageCollectionMock = vi.fn()
const emitAnnouncementMock = vi.fn()

const PATH = "/api/message/send-announcement"

vi.mock("../../common/redis", () => ({
	default: {
		get: redisGetMock
	}
}))

vi.mock("../../common/socket", () => ({
	emitAnnouncement: emitAnnouncementMock
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

describe("POST /api/message/send-announcement", () => {
	let app: express.Express
	let consoleErrorSpy: ReturnType<typeof vi.spyOn>

	beforeAll(async () => {
		process.env.JWT_SECRET = "unit-test-secret"
		process.env.JWT_ISSUER = "unit-test-issuer"

		const { default: sendAnnouncementRoutes } = await import("./send-announcement")
		app = express()
		app.use(express.json())
		app.use("/api", sendAnnouncementRoutes)
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
			message: "Hello"
		})

		expect(res.status).toBe(401)
		expect(res.body).toMatchObject({
			success: false,
			message: "auth-middleware.messages.token-required",
			status_code: 401
		})
		expect(getChatMessageCollectionMock).not.toHaveBeenCalled()
	})

	it("returns 400 when message is invalid", async () => {
		const accessToken = buildAccessToken(1, "session-send-announcement-1")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 1 }))

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({
				message: ""
			})

		expect(res.status).toBe(400)
		expect(res.body).toMatchObject({
			success: false,
			message: "Invalid message",
			status_code: 400
		})
	})

	it("returns 201 and inserts announcement successfully", async () => {
		const accessToken = buildAccessToken(82, "session-send-announcement-2")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 82 }))
		userFindUniqueMock.mockResolvedValue({
			id: 82n,
			display_name: "TestUser",
			avatar_seq: 3
		})

		const insertedId = new ObjectId()
		insertOneMock.mockResolvedValue({ insertedId })
		getChatMessageCollectionMock.mockResolvedValue({ insertOne: insertOneMock })

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({
				message: "go go go"
			})

		expect(res.status).toBe(201)
		expect(insertOneMock).toHaveBeenCalledWith(
			expect.objectContaining({
				type: "announcement",
				sender_id: 82,
				message: "go go go",
				timestamp: expect.any(Date)
			})
		)
		expect(res.body).toMatchObject({
			success: true,
			message: "Success",
			status_code: 201,
			data: {
				_id: insertedId.toString(),
				sender: {
					id: 82,
					display_name: "TestUser",
					avatar_url: expect.any(String)
				},
				message: "go go go"
			}
		})
		expect(typeof res.body.data.timestamp).toBe("string")
		// Broadcasts the new announcement to all clients, tagged with the sender.
		expect(emitAnnouncementMock).toHaveBeenCalledWith(
			expect.objectContaining({ _id: insertedId.toString(), message: "go go go" }),
			82
		)
	})

	it("returns 500 when mongodb insert fails", async () => {
		const accessToken = buildAccessToken(1, "session-send-announcement-3")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 1 }))
		consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined)
		getChatMessageCollectionMock.mockRejectedValue(new Error("mongo down"))

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({
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
