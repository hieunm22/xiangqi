import express from "express"
import jwt from "jsonwebtoken"
import request from "supertest"
import { ObjectId } from "mongodb"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"

const redisGetMock = vi.fn()
const toArrayMock = vi.fn()
const aggregateMock = vi.fn()
const getChatMessageCollectionMock = vi.fn()
const prismaUserFindManyMock = vi.fn()

const PATH = "/api/message/get-private-conversations"

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
			findMany: prismaUserFindManyMock
		}
	}
}))

describe("GET /api/message/get-private-conversations", () => {
	let app: express.Express
	let consoleErrorSpy: ReturnType<typeof vi.spyOn>

	beforeAll(async () => {
		process.env.JWT_SECRET = "unit-test-secret"
		process.env.JWT_ISSUER = "unit-test-issuer"

		const { default: getPrivateConversationsRoutes } = await import("./get-private-conversations")
		app = express()
		app.use(express.json())
		app.use("/api", getPrivateConversationsRoutes)
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
		const res = await request(app).get(PATH)

		expect(res.status).toBe(401)
		expect(res.body).toMatchObject({
			success: false,
			message: "auth-middleware.messages.token-required",
			status_code: 401
		})
		expect(getChatMessageCollectionMock).not.toHaveBeenCalled()
	})

	it("returns 200 and empty array when user has no conversations", async () => {
		const accessToken = buildAccessToken(1, "session-conv-1")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 1 }))

		toArrayMock.mockResolvedValue([])
		aggregateMock.mockReturnValue({ toArray: toArrayMock })
		getChatMessageCollectionMock.mockResolvedValue({ aggregate: aggregateMock })
		prismaUserFindManyMock.mockResolvedValue([])

		const res = await request(app)
			.get(PATH)
			.set("Authorization", `Bearer ${accessToken}`)

		expect(res.status).toBe(200)
		expect(res.body).toMatchObject({
			success: true,
			message: "Success",
			status_code: 200,
			data: []
		})

		// Verify the pipeline filters private messages of the current user.
		const pipeline = aggregateMock.mock.calls[0][0]
		expect(pipeline[0]).toMatchObject({
			$match: {
				conversation_key: { $exists: true },
				$or: [
					{ sender_id: 1 },
					{ receiver_id: 1 }
				]
			}
		})
		// Conversations ordered by latest message time descending.
		const sortStages = pipeline.filter((stage: any) => stage.$sort)
		expect(sortStages[sortStages.length - 1]).toMatchObject({ $sort: { last_timestamp: -1 } })
	})

	it("returns 200 with conversations, partner info and unread count", async () => {
		const accessToken = buildAccessToken(1, "session-conv-2")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 1 }))

		const lastId1 = new ObjectId()
		const lastId2 = new ObjectId()
		const ts1 = new Date("2026-06-15T11:00:00Z")
		const ts2 = new Date("2026-06-15T10:00:00Z")

		toArrayMock.mockResolvedValue([
			{
				_id: "1_2",
				last_message_id: lastId1,
				last_message: "Latest with Bob",
				last_sender_id: 2,
				last_receiver_id: 1,
				last_timestamp: ts1,
				unread_count: 2
			},
			{
				_id: "1_5",
				last_message_id: lastId2,
				last_message: "Latest with Carol",
				last_sender_id: 1,
				last_receiver_id: 5,
				last_timestamp: ts2,
				unread_count: 0
			}
		])
		aggregateMock.mockReturnValue({ toArray: toArrayMock })
		getChatMessageCollectionMock.mockResolvedValue({ aggregate: aggregateMock })
		prismaUserFindManyMock.mockResolvedValue([
			{ id: BigInt(2), display_name: "Bob", avatar_seq: 0 },
			{ id: BigInt(5), display_name: "Carol", avatar_seq: 3 }
		])

		const res = await request(app)
			.get(PATH)
			.set("Authorization", `Bearer ${accessToken}`)

		expect(res.status).toBe(200)
		expect(res.body.data).toHaveLength(2)
		expect(res.body.data[0]).toMatchObject({
			conversation_key: "1_2",
			partner: { id: 2, display_name: "Bob", avatar_url: "/images/2.jpg" },
			last_message: {
				_id: lastId1.toString(),
				message: "Latest with Bob",
				sender_id: 2,
				timestamp: ts1.toISOString()
			},
			unread_count: 2
		})
		expect(res.body.data[1]).toMatchObject({
			conversation_key: "1_5",
			partner: { id: 5, display_name: "Carol", avatar_url: "/images/5_3.jpg" },
			last_message: {
				_id: lastId2.toString(),
				message: "Latest with Carol",
				sender_id: 1,
				timestamp: ts2.toISOString()
			},
			unread_count: 0
		})

		// Partner ids resolved in a single query: the "other" participant for each.
		expect(prismaUserFindManyMock).toHaveBeenCalledWith({
			where: { id: { in: [BigInt(2), BigInt(5)] } },
			select: { id: true, display_name: true, avatar_seq: true }
		})
	})

	it("returns null partner when the other user no longer exists", async () => {
		const accessToken = buildAccessToken(3, "session-conv-3")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 3 }))

		const lastId = new ObjectId()
		toArrayMock.mockResolvedValue([
			{
				_id: "3_9",
				last_message_id: lastId,
				last_message: "Hello?",
				last_sender_id: 9,
				last_receiver_id: 3,
				last_timestamp: new Date("2026-06-15T09:00:00Z"),
				unread_count: 1
			}
		])
		aggregateMock.mockReturnValue({ toArray: toArrayMock })
		getChatMessageCollectionMock.mockResolvedValue({ aggregate: aggregateMock })
		prismaUserFindManyMock.mockResolvedValue([])

		const res = await request(app)
			.get(PATH)
			.set("Authorization", `Bearer ${accessToken}`)

		expect(res.status).toBe(200)
		expect(res.body.data[0]).toMatchObject({
			conversation_key: "3_9",
			partner: null,
			unread_count: 1
		})
	})

	it("returns 500 when mongo query fails", async () => {
		const accessToken = buildAccessToken(1, "session-conv-4")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 1 }))
		consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined)
		getChatMessageCollectionMock.mockRejectedValue(new Error("mongo down"))

		const res = await request(app)
			.get(PATH)
			.set("Authorization", `Bearer ${accessToken}`)

		expect(res.status).toBe(500)
		expect(res.body).toMatchObject({
			success: false,
			message: "Internal server error",
			status_code: 500
		})
	})
})
