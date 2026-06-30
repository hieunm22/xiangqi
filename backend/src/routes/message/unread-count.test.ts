import express from "express"
import jwt from "jsonwebtoken"
import request from "supertest"
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

const redisGetMock = vi.fn()
const countDocumentsMock = vi.fn()
const aggregateMock = vi.fn()
const getChatMessageCollectionMock = vi.fn()
const announcementReadFindFirstMock = vi.fn()

const PATH = "/api/message/unread-count"

vi.mock("../../common/redis", () => ({
	default: {
		get: redisGetMock
	}
}))

vi.mock("prisma", () => ({
	default: {
		userAnnouncementRead: {
			findFirst: announcementReadFindFirstMock
		}
	}
}))

vi.mock("../../common/mongodb", () => ({
	getChatMessageCollection: getChatMessageCollectionMock
}))

describe("GET /api/message/unread-count", () => {
	let app: express.Express
	let consoleErrorSpy: ReturnType<typeof vi.spyOn>

	beforeAll(async () => {
		process.env.JWT_SECRET = "unit-test-secret"
		process.env.JWT_ISSUER = "unit-test-issuer"

		const { default: unreadCountRoutes } = await import("./unread-count")
		app = express()
		app.use(express.json())
		app.use("/api", unreadCountRoutes)
	})

	beforeEach(() => {
		// Default: user has no announcement read mark -> announcements treated as 0.
		announcementReadFindFirstMock.mockResolvedValue(null)
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
		expect(countDocumentsMock).not.toHaveBeenCalled()
	})

	it("returns 200 with zero unread messages when user has no unread messages", async () => {
		const accessToken = buildAccessToken(1, "session-unread-1")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 1 }))

		countDocumentsMock.mockResolvedValue(0)
		aggregateMock.mockReturnValue({
			toArray: vi.fn().mockResolvedValue([])
		})
		getChatMessageCollectionMock.mockResolvedValue({
			countDocuments: countDocumentsMock,
			aggregate: aggregateMock
		})

		const res = await request(app)
			.get(PATH)
			.set("Authorization", `Bearer ${accessToken}`)

		expect(res.status).toBe(200)
		expect(res.body).toMatchObject({
			success: true,
			message: "Success",
			status_code: 200,
			data: {
				total_pm: 0,
				conversations: [],
				announcements: 0
			}
		})
		expect(countDocumentsMock).toHaveBeenCalledWith({
			receiver_id: 1,
			seen: false
		})
	})

	it("returns the count of announcements created after the user's last read mark", async () => {
		const accessToken = buildAccessToken(1, "session-unread-announce")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 1 }))

		const lastReadAt = new Date("2026-06-19T05:00:00.000Z")
		announcementReadFindFirstMock.mockResolvedValue({ read_announcement_at: lastReadAt })

		// First countDocuments call = unread PMs, second = new announcements.
		countDocumentsMock.mockResolvedValueOnce(0).mockResolvedValueOnce(3)
		aggregateMock.mockReturnValue({
			toArray: vi.fn().mockResolvedValue([])
		})
		getChatMessageCollectionMock.mockResolvedValue({
			countDocuments: countDocumentsMock,
			aggregate: aggregateMock
		})

		const res = await request(app)
			.get(PATH)
			.set("Authorization", `Bearer ${accessToken}`)

		expect(res.status).toBe(200)
		expect(res.body.data).toMatchObject({
			total_pm: 0,
			announcements: 3
		})
		expect(announcementReadFindFirstMock).toHaveBeenCalledWith({
			where: { user_id: 1n },
			orderBy: { read_announcement_at: "desc" },
			select: { read_announcement_at: true }
		})
		expect(countDocumentsMock).toHaveBeenCalledWith({
			type: "announcement",
			timestamp: { $gt: lastReadAt }
		})
	})

	it("returns 200 with total unread count and conversations with count", async () => {
		const accessToken = buildAccessToken(1, "session-unread-2")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 1 }))

		countDocumentsMock.mockResolvedValue(5)
		aggregateMock.mockReturnValue({
			toArray: vi.fn().mockResolvedValue([
				{ _id: "1_2", count: 3 },
				{ _id: "1_5", count: 2 }
			])
		})
		getChatMessageCollectionMock.mockResolvedValue({
			countDocuments: countDocumentsMock,
			aggregate: aggregateMock
		})

		const res = await request(app)
			.get(PATH)
			.set("Authorization", `Bearer ${accessToken}`)

		expect(res.status).toBe(200)
		expect(res.body).toMatchObject({
			success: true,
			message: "Success",
			status_code: 200,
			data: {
				total_pm: 5,
				conversations: [
					{ conversation_key: "1_2", count: 3 },
					{ conversation_key: "1_5", count: 2 }
				],
				announcements: 0
			}
		})
	})

	it("counts only messages with seen: false (unread) grouped by conversation_key", async () => {
		const accessToken = buildAccessToken(3, "session-unread-3")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 3 }))

		countDocumentsMock.mockResolvedValue(2)
		aggregateMock.mockReturnValue({
			toArray: vi.fn().mockResolvedValue([
				{ _id: "2_3", count: 2 }
			])
		})
		getChatMessageCollectionMock.mockResolvedValue({
			countDocuments: countDocumentsMock,
			aggregate: aggregateMock
		})

		const res = await request(app)
			.get(PATH)
			.set("Authorization", `Bearer ${accessToken}`)

		expect(res.status).toBe(200)
		// Verify the query filters by receiver_id and seen: false
		expect(countDocumentsMock).toHaveBeenCalledWith({
			receiver_id: 3,
			seen: false
		})
		// Verify aggregate groups by conversation_key
		const aggregateCall = aggregateMock.mock.calls[0][0]
		expect(aggregateCall[0]).toMatchObject({
			$match: {
				receiver_id: 3,
				seen: false
			}
		})
		const groupStage = aggregateCall.find((stage: any) => stage.$group)
		expect(groupStage).toMatchObject({
			$group: {
				_id: "$conversation_key",
				count: { $sum: 1 }
			}
		})
	})

	it("returns conversations sorted by conversation_key in ascending order", async () => {
		const accessToken = buildAccessToken(1, "session-unread-4")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 1 }))

		countDocumentsMock.mockResolvedValue(6)
		aggregateMock.mockReturnValue({
			toArray: vi.fn().mockResolvedValue([
				{ _id: "1_2", count: 1 },
				{ _id: "1_5", count: 2 },
				{ _id: "1_8", count: 3 }
			])
		})
		getChatMessageCollectionMock.mockResolvedValue({
			countDocuments: countDocumentsMock,
			aggregate: aggregateMock
		})

		const res = await request(app)
			.get(PATH)
			.set("Authorization", `Bearer ${accessToken}`)

		expect(res.status).toBe(200)
		expect(res.body.data.conversations).toEqual([
			{ conversation_key: "1_2", count: 1 },
			{ conversation_key: "1_5", count: 2 },
			{ conversation_key: "1_8", count: 3 }
		])
		// Verify sort in aggregation pipeline
		const aggregateCall = aggregateMock.mock.calls[0][0]
		const sortStage = aggregateCall.find((stage: any) => stage.$sort)
		expect(sortStage).toMatchObject({ $sort: { _id: 1 } })
	})

	it("returns 500 when mongo query fails", async () => {
		const accessToken = buildAccessToken(1, "session-unread-5")
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
