import express from "express"
import jwt from "jsonwebtoken"
import request from "supertest"
import { ObjectId } from "mongodb"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"

const redisGetMock = vi.fn()
const toArrayMock = vi.fn()
const sortMock = vi.fn()
const findMock = vi.fn()
const getChatMessageCollectionMock = vi.fn()
const prismaUserFindUniqueMock = vi.fn()

const PATH = "/api/message/get-private"

vi.mock("../../common/redis", () => ({
	default: {
		get: redisGetMock
	}
}))

vi.mock("../../common/mongodb", () => ({
	getChatMessageCollection: getChatMessageCollectionMock
}))

vi.mock("prisma", () => ({
	default: {
		user: {
			findUnique: prismaUserFindUniqueMock
		}
	}
}))

describe("GET /api/message/get-private", () => {
	let app: express.Express
	let consoleErrorSpy: ReturnType<typeof vi.spyOn>

	beforeAll(async () => {
		process.env.JWT_SECRET = "unit-test-secret"
		process.env.JWT_ISSUER = "unit-test-issuer"

		const { default: getPrivateRoutes } = await import("./get-private")
		app = express()
		app.use(express.json())
		app.use("/api", getPrivateRoutes)
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
		const res = await request(app).get(`${PATH}?receiver_id=2`)

		expect(res.status).toBe(401)
		expect(res.body).toMatchObject({
			success: false,
			message: "auth-middleware.messages.token-required",
			status_code: 401
		})
		expect(getChatMessageCollectionMock).not.toHaveBeenCalled()
	})

	it("returns 400 when receiver_id is missing", async () => {
		const accessToken = buildAccessToken(1, "session-get-1")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 1 }))

		const res = await request(app)
			.get(PATH)
			.set("Authorization", `Bearer ${accessToken}`)

		expect(res.status).toBe(400)
		expect(res.body).toMatchObject({
			success: false,
			message: "Invalid receiver_id",
			status_code: 400
		})
		expect(getChatMessageCollectionMock).not.toHaveBeenCalled()
	})

	it("returns 400 when receiver_id is invalid", async () => {
		const accessToken = buildAccessToken(1, "session-get-2")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 1 }))

		const res = await request(app)
			.get(`${PATH}?receiver_id=abc`)
			.set("Authorization", `Bearer ${accessToken}`)

		expect(res.status).toBe(400)
		expect(res.body).toMatchObject({
			success: false,
			message: "Invalid receiver_id",
			status_code: 400
		})
		expect(getChatMessageCollectionMock).not.toHaveBeenCalled()
	})

	it("returns 200 and empty array when no messages exist", async () => {
		const accessToken = buildAccessToken(1, "session-get-3")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 1 }))

		toArrayMock.mockResolvedValue([])
		sortMock.mockReturnValue({ toArray: toArrayMock })
		findMock.mockReturnValue({ sort: sortMock })
		getChatMessageCollectionMock.mockResolvedValue({ find: findMock })

		const res = await request(app)
			.get(`${PATH}?receiver_id=2`)
			.set("Authorization", `Bearer ${accessToken}`)

		expect(res.status).toBe(200)
		expect(findMock).toHaveBeenCalledWith({
			$or: [
				{ sender_id: 1, receiver_id: 2 },
				{ sender_id: 2, receiver_id: 1 }
			]
		})
		expect(sortMock).toHaveBeenCalledWith({ timestamp: 1 })
		expect(res.body).toMatchObject({
			success: true,
			message: "Success",
			status_code: 200,
			data: []
		})
	})

	it("returns 200 and all messages between sender and receiver (sorted ascending)", async () => {
		const accessToken = buildAccessToken(1, "session-get-4")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 1 }))

		const messageId1 = new ObjectId()
		const messageId2 = new ObjectId()
		const messageId3 = new ObjectId()
		const timestamp1 = new Date("2026-06-15T10:00:00Z")
		const timestamp2 = new Date("2026-06-15T10:30:00Z")
		const timestamp3 = new Date("2026-06-15T11:00:00Z")

		prismaUserFindUniqueMock.mockImplementation(({ where }: { where: { id: bigint } }) => {
			const id = Number(where.id)
			if (id === 1) return Promise.resolve({ id: BigInt(1), display_name: "Alice", avatar_seq: 0 })
			if (id === 2) return Promise.resolve({ id: BigInt(2), display_name: "Bob", avatar_seq: 0 })
			return Promise.resolve(null)
		})
		toArrayMock.mockResolvedValue([
			{
				_id: messageId1,
				message: "Message 1 from user 1",
				sender_id: 1,
				receiver_id: 2,
				timestamp: timestamp1,
				seen: false
			},
			{
				_id: messageId2,
				message: "Message 2 from user 2",
				sender_id: 2,
				receiver_id: 1,
				timestamp: timestamp2,
				seen: true
			},
			{
				_id: messageId3,
				message: "Message 3 from user 1",
				sender_id: 1,
				receiver_id: 2,
				timestamp: timestamp3,
				seen: false
			}
		])
		sortMock.mockReturnValue({ toArray: toArrayMock })
		findMock.mockReturnValue({ sort: sortMock })
		getChatMessageCollectionMock.mockResolvedValue({ find: findMock })

		const res = await request(app)
			.get(`${PATH}?receiver_id=2`)
			.set("Authorization", `Bearer ${accessToken}`)

		expect(res.status).toBe(200)
		expect(res.body).toMatchObject({
			success: true,
			message: "Success",
			status_code: 200
		})
		expect(res.body.data).toHaveLength(3)
		expect(res.body.data[0]).toMatchObject({
			_id: messageId1.toString(),
			message: "Message 1 from user 1",
			sender: expect.objectContaining({ id: 1 }),
			receiver_id: 2,
			seen: false,
			timestamp: timestamp1.toISOString()
		})
		expect(res.body.data[1]).toMatchObject({
			_id: messageId2.toString(),
			message: "Message 2 from user 2",
			sender: expect.objectContaining({ id: 2 }),
			receiver_id: 1,
			seen: true
		})
		expect(res.body.data[2]).toMatchObject({
			_id: messageId3.toString(),
			message: "Message 3 from user 1",
			sender: expect.objectContaining({ id: 1 }),
			receiver_id: 2,
			seen: false
		})
		// Verify sort was called with timestamp ascending
		expect(sortMock).toHaveBeenCalledWith({ timestamp: 1 })
	})

	it("returns 200 with messages from both directions (sender->receiver and receiver->sender)", async () => {
		const accessToken = buildAccessToken(5, "session-get-5")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 5 }))

		const messageId1 = new ObjectId()
		const messageId2 = new ObjectId()

		prismaUserFindUniqueMock.mockResolvedValue(null)
		toArrayMock.mockResolvedValue([
			{
				_id: messageId1,
				message: "From 3 to 5",
				sender_id: 3,
				receiver_id: 5,
				timestamp: new Date("2026-06-15T10:00:00Z")
			},
			{
				_id: messageId2,
				message: "From 5 to 3",
				sender_id: 5,
				receiver_id: 3,
				timestamp: new Date("2026-06-15T10:30:00Z")
			}
		])
		sortMock.mockReturnValue({ toArray: toArrayMock })
		findMock.mockReturnValue({ sort: sortMock })
		getChatMessageCollectionMock.mockResolvedValue({ find: findMock })

		const res = await request(app)
			.get(`${PATH}?receiver_id=3`)
			.set("Authorization", `Bearer ${accessToken}`)

		expect(res.status).toBe(200)
		// Query should check both directions
		expect(findMock).toHaveBeenCalledWith({
			$or: [
				{ sender_id: 5, receiver_id: 3 },
				{ sender_id: 3, receiver_id: 5 }
			]
		})
		expect(res.body.data).toHaveLength(2)
	})

	it("returns 500 when mongo query fails", async () => {
		const accessToken = buildAccessToken(1, "session-get-6")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 1 }))
		consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined)
		getChatMessageCollectionMock.mockRejectedValue(new Error("mongo down"))

		const res = await request(app)
			.get(`${PATH}?receiver_id=2`)
			.set("Authorization", `Bearer ${accessToken}`)

		expect(res.status).toBe(500)
		expect(res.body).toMatchObject({
			success: false,
			message: "Internal server error",
			status_code: 500
		})
	})
})
