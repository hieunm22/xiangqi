import express from "express"
import jwt from "jsonwebtoken"
import request from "supertest"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"

const redisGetMock = vi.fn()
const userFindManyMock = vi.fn()
const roomUserFindManyMock = vi.fn()
const getActiveUserStatusesMock = vi.fn()

const PATH = "/api/game/online"

vi.mock("../../common/redis", () => ({
	default: {
		get: redisGetMock
	}
}))

vi.mock("prisma", () => ({
	default: {
		user: {
			findMany: userFindManyMock
		},
		roomUser: {
			findMany: roomUserFindManyMock
		}
	}
}))

vi.mock("../../common/presence", () => ({
	getActiveUserStatuses: getActiveUserStatusesMock
}))

describe("GET /api/game/online", () => {
	let app: express.Express
	let consoleErrorSpy: ReturnType<typeof vi.spyOn>

	beforeAll(async () => {
		process.env.JWT_SECRET = "unit-test-secret"
		process.env.JWT_ISSUER = "unit-test-issuer"

		const { default: getOnlineRoutes } = await import("./get-online")
		app = express()
		app.use(express.json())
		app.use("/api", getOnlineRoutes)
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
		expect(getActiveUserStatusesMock).not.toHaveBeenCalled()
	})

	it("returns 200 with an empty list when nobody is online", async () => {
		const accessToken = buildAccessToken(21, "session-online-1")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 21 }))
		getActiveUserStatusesMock.mockResolvedValue([])
		roomUserFindManyMock.mockResolvedValue([])

		const res = await request(app).get(PATH).set("Authorization", `Bearer ${accessToken}`)

		expect(res.status).toBe(200)
		expect(res.body).toMatchObject({
			success: true,
			message: "get-online.messages.success",
			status_code: 200,
			data: { count: 0, users: [] }
		})
		expect(userFindManyMock).not.toHaveBeenCalled()
	})

	it("returns 200 with enriched users carrying their presence status", async () => {
		const accessToken = buildAccessToken(21, "session-online-2")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 21 }))
		getActiveUserStatusesMock.mockResolvedValue([
			{ userId: 11, status: "online" },
			{ userId: 12, status: "inactive" }
		])
		roomUserFindManyMock.mockResolvedValue([])
		userFindManyMock.mockResolvedValue([
			{ id: BigInt(11), display_name: "Alice", avatar_seq: 0 },
			{ id: BigInt(12), display_name: "Bob", avatar_seq: 2 }
		])

		const res = await request(app).get(PATH).set("Authorization", `Bearer ${accessToken}`)

		expect(res.status).toBe(200)
		expect(res.body).toMatchObject({
			success: true,
			message: "get-online.messages.success",
			status_code: 200
		})
		expect(res.body.data.count).toBe(2)
		expect(res.body.data.users).toHaveLength(2)
		expect(res.body.data.users[0]).toMatchObject({
			id: 11,
			display_name: "Alice",
			avatar_url: "/images/11.jpg",
			status: "online"
		})
		expect(res.body.data.users[1]).toMatchObject({
			id: 12,
			display_name: "Bob",
			avatar_url: "/images/12_2.jpg",
			status: "inactive"
		})
		expect(userFindManyMock).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { id: { in: [BigInt(11), BigInt(12)] }, is_bot: false },
				select: { id: true, display_name: true, avatar_seq: true }
			})
		)
	})

	it("marks players in a started game as busy (overriding heartbeat status)", async () => {
		const accessToken = buildAccessToken(21, "session-online-busy")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 21 }))
		getActiveUserStatusesMock.mockResolvedValue([
			{ userId: 11, status: "online" }
		])
		// User 12 is in a started game but not in the heartbeat list — still busy.
		roomUserFindManyMock.mockResolvedValue([
			{ user_id: BigInt(11) },
			{ user_id: BigInt(12) }
		])
		userFindManyMock.mockResolvedValue([
			{ id: BigInt(11), display_name: "Alice", avatar_seq: 0 },
			{ id: BigInt(12), display_name: "Bob", avatar_seq: 0 }
		])

		const res = await request(app).get(PATH).set("Authorization", `Bearer ${accessToken}`)

		expect(res.status).toBe(200)
		expect(res.body.data.count).toBe(2)
		const byId = Object.fromEntries(res.body.data.users.map((u: any) => [u.id, u.status]))
		expect(byId).toEqual({ 11: "busy", 12: "busy" })
	})

	it("returns 500 when an unexpected error happens", async () => {
		const accessToken = buildAccessToken(21, "session-online-3")
		consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined)
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 21 }))
		getActiveUserStatusesMock.mockRejectedValue(new Error("redis down"))

		const res = await request(app).get(PATH).set("Authorization", `Bearer ${accessToken}`)

		expect(res.status).toBe(500)
		expect(res.body).toMatchObject({
			success: false,
			message: "get-online.messages.internal-server-error",
			status_code: 500,
			data: { count: 0, users: [] }
		})
	})
})
