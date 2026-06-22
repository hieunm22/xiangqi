import express from "express"
import jwt from "jsonwebtoken"
import request from "supertest"
import { ObjectId } from "mongodb"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"

const redisGetMock = vi.fn()
const userFindUniqueMock = vi.fn()
const announcementReadFindFirstMock = vi.fn()
const findMock = vi.fn()
const sortMock = vi.fn()
const limitMock = vi.fn()
const toArrayMock = vi.fn()
const getChatMessageCollectionMock = vi.fn()

const PATH = "/api/message/get-announcement"

vi.mock("../../common/redis", () => ({
	default: {
		get: redisGetMock
	}
}))

vi.mock("prisma", () => ({
	default: {
		user: {
			findUnique: userFindUniqueMock
		},
		userAnnouncementRead: {
			findFirst: announcementReadFindFirstMock
		}
	}
}))

vi.mock("../../common/mongodb", () => ({
	getChatMessageCollection: getChatMessageCollectionMock
}))

describe("GET /api/message/get-announcement", () => {
	let app: express.Express
	let consoleErrorSpy: ReturnType<typeof vi.spyOn>

	beforeAll(async () => {
		process.env.JWT_SECRET = "unit-test-secret"
		process.env.JWT_ISSUER = "unit-test-issuer"

		const { default: getAnnouncementRoutes } = await import("./get-announcement")
		app = express()
		app.use(express.json())
		app.use("/api", getAnnouncementRoutes)
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

	it("returns 200 and marks announcements seen relative to last read time", async () => {
		const accessToken = buildAccessToken(1, "session-get-announcement-1")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 1 }))

		const oldId = new ObjectId()
		const newId = new ObjectId()
		const oldTimestamp = new Date("2026-06-19T05:00:00.000Z")
		const newTimestamp = new Date("2026-06-19T06:00:00.000Z")
		const lastReadAt = new Date("2026-06-19T05:30:00.000Z")

		toArrayMock
			.mockResolvedValueOnce([
				{ _id: newId, sender_id: 82, message: "new", timestamp: newTimestamp }
			])
			.mockResolvedValueOnce([
				{ _id: oldId, sender_id: 82, message: "old", timestamp: oldTimestamp }
			])
		limitMock.mockReturnValue({ toArray: toArrayMock })
		sortMock.mockReturnValue({ toArray: toArrayMock, limit: limitMock })
		findMock.mockReturnValue({ sort: sortMock })
		getChatMessageCollectionMock.mockResolvedValue({ find: findMock })

		announcementReadFindFirstMock.mockResolvedValue({ read_announcement_at: lastReadAt })
		userFindUniqueMock.mockResolvedValue({
			id: 82n,
			display_name: "TestUser",
			avatar_seq: 3
		})

		const res = await request(app)
			.get(PATH)
			.set("Authorization", `Bearer ${accessToken}`)

		expect(res.status).toBe(200)
		expect(findMock).toHaveBeenCalledWith({ type: "announcement", timestamp: { $gt: lastReadAt } })
		expect(findMock).toHaveBeenCalledWith({ type: "announcement", timestamp: { $lte: lastReadAt } })
		expect(sortMock).toHaveBeenCalledWith({ timestamp: 1 })
		expect(sortMock).toHaveBeenCalledWith({ timestamp: -1 })
		expect(limitMock).toHaveBeenCalledWith(20)
		expect(res.body.data).toMatchObject([
			{ _id: oldId.toString(), message: "old", seen: true },
			{ _id: newId.toString(), message: "new", seen: false }
		])
	})

	it("marks every announcement unseen when user has never read", async () => {
		const accessToken = buildAccessToken(1, "session-get-announcement-2")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 1 }))

		const announcementId = new ObjectId()
		const timestamp = new Date("2026-06-19T05:07:22.194Z")
		toArrayMock.mockResolvedValue([
			{ _id: announcementId, sender_id: 82, message: "go go go", timestamp }
		])
		limitMock.mockReturnValue({ toArray: toArrayMock })
		sortMock.mockReturnValue({ toArray: toArrayMock, limit: limitMock })
		findMock.mockReturnValue({ sort: sortMock })
		getChatMessageCollectionMock.mockResolvedValue({ find: findMock })

		announcementReadFindFirstMock.mockResolvedValue(null)
		userFindUniqueMock.mockResolvedValue({
			id: 82n,
			display_name: "TestUser",
			avatar_seq: 3
		})

		const res = await request(app)
			.get(PATH)
			.set("Authorization", `Bearer ${accessToken}`)

		expect(res.status).toBe(200)
		expect(res.body.data).toMatchObject([
			{ _id: announcementId.toString(), message: "go go go", seen: false }
		])
	})

	it("pages older announcements using the before header", async () => {
		const accessToken = buildAccessToken(1, "session-get-announcement-before")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 1 }))

		const olderId = new ObjectId()
		const olderTimestamp = new Date("2026-06-19T04:00:00.000Z")
		const before = new Date("2026-06-19T05:00:00.000Z")
		const lastReadAt = new Date("2026-06-19T05:30:00.000Z")

		toArrayMock.mockResolvedValue([
			{ _id: olderId, sender_id: 82, message: "older", timestamp: olderTimestamp }
		])
		limitMock.mockReturnValue({ toArray: toArrayMock })
		sortMock.mockReturnValue({ toArray: toArrayMock, limit: limitMock })
		findMock.mockReturnValue({ sort: sortMock })
		getChatMessageCollectionMock.mockResolvedValue({ find: findMock })

		announcementReadFindFirstMock.mockResolvedValue({ read_announcement_at: lastReadAt })
		userFindUniqueMock.mockResolvedValue({
			id: 82n,
			display_name: "TestUser",
			avatar_seq: 3
		})

		const res = await request(app)
			.get(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.set("before", before.toISOString())

		expect(res.status).toBe(200)
		expect(findMock).toHaveBeenCalledWith({ type: "announcement", timestamp: { $lt: before } })
		expect(sortMock).toHaveBeenCalledWith({ timestamp: -1 })
		expect(limitMock).toHaveBeenCalledWith(20)
		expect(res.body.data).toMatchObject([
			{ _id: olderId.toString(), message: "older" }
		])
	})

	it("returns 500 when mongodb read fails", async () => {
		const accessToken = buildAccessToken(1, "session-get-announcement-3")
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
