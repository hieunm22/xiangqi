import express from "express"
import jwt from "jsonwebtoken"
import request from "supertest"
import {
	afterEach,
	beforeAll,
	describe,
	expect,
	it,
	vi
} from "vitest"

const redisGetMock = vi.fn()
const redisSetMock = vi.fn()
const achievementFindManyMock = vi.fn()
const userAchievementFindManyMock = vi.fn()

const PATH = "/api/user/achievements"

vi.mock("../../common/redis", () => ({
	default: {
		get: redisGetMock,
		set: redisSetMock,
	}
}))

vi.mock("prisma", () => ({
	default: {
		achievement: {
			findMany: achievementFindManyMock
		},
		userAchievement: {
			findMany: userAchievementFindManyMock
		}
	}
}))

describe("GET /api/user/achievements", () => {
	let app: express.Express

	beforeAll(async () => {
		process.env.JWT_SECRET = "unit-test-secret"
		process.env.JWT_ISSUER = "unit-test-issuer"

		const { default: getAchievementsRoutes } = await import("./get-achievements")
		app = express()
		app.use(express.json())
		app.use("/api", getAchievementsRoutes)
	})

	afterEach(() => {
		vi.clearAllMocks()
	})

	const buildAccessToken = (userId: number, sessionId: string) =>
		jwt.sign({ sub: userId, jti: sessionId }, process.env.JWT_SECRET as string, {
			issuer: process.env.JWT_ISSUER,
			expiresIn: "1h"
		})

	it("returns 401 when authorization token is missing", async () => {
		const res = await request(app).get(`${PATH}?userId=1`)

		expect(res.status).toBe(401)
		expect(res.body).toMatchObject({
			success: false,
			message: "auth-middleware.messages.token-required",
			status_code: 401
		})
	})

	it("returns 400 when userId query param is missing", async () => {
		const token = buildAccessToken(1, "session-ach-1")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 1 }))

		const res = await request(app)
			.get(PATH)
			.set("Authorization", `Bearer ${token}`)

		expect(res.status).toBe(400)
		expect(res.body).toMatchObject({
			success: false,
			message: "achievement.messages.invalid-user-id",
			status_code: 400
		})
	})

	it("returns 400 when userId is not a number", async () => {
		const token = buildAccessToken(1, "session-ach-2")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 1 }))

		const res = await request(app)
			.get(`${PATH}?userId=abc`)
			.set("Authorization", `Bearer ${token}`)

		expect(res.status).toBe(400)
		expect(res.body).toMatchObject({
			success: false,
			message: "achievement.messages.invalid-user-id",
			status_code: 400
		})
	})

	it.each([0, -1, -5])("returns 400 when userId is non-positive (%i)", async (userId) => {
		const token = buildAccessToken(1, "session-ach-3")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 1 }))

		const res = await request(app)
			.get(`${PATH}?userId=${userId}`)
			.set("Authorization", `Bearer ${token}`)

		expect(res.status).toBe(400)
		expect(res.body).toMatchObject({
			success: false,
			message: "achievement.messages.invalid-user-id",
			status_code: 400
		})
	})

	it("returns 200 with earned flags reflecting the user's awarded achievements", async () => {
		const token = buildAccessToken(1, "session-ach-4")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 1 }))

		achievementFindManyMock.mockResolvedValueOnce([
			{ id: 1, name: "achievement.title-02" },
			{ id: 2, name: "achievement.title-06" },
			{ id: 3, name: "achievement.title-07" }
		])
		// User earned only the first-win achievement.
		userAchievementFindManyMock.mockResolvedValueOnce([{ achievement_id: 1 }])

		const res = await request(app)
			.get(`${PATH}?userId=1`)
			.set("Authorization", `Bearer ${token}`)

		expect(res.status).toBe(200)
		expect(res.body).toMatchObject({
			success: true,
			message: "achievement.messages.success",
			status_code: 200,
			data: [
				{ id: 1, name: "achievement.title-02", earned: true },
				{ id: 2, name: "achievement.title-06", earned: false },
				{ id: 3, name: "achievement.title-07", earned: false }
			]
		})
	})

	it("returns 200 with all earned=false when the user has no achievements", async () => {
		const token = buildAccessToken(1, "session-ach-5")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 1 }))

		achievementFindManyMock.mockResolvedValueOnce([
			{ id: 1, name: "achievement.title-02" },
			{ id: 2, name: "achievement.title-06" },
			{ id: 3, name: "achievement.title-07" }
		])
		userAchievementFindManyMock.mockResolvedValueOnce([])

		const res = await request(app)
			.get(`${PATH}?userId=1`)
			.set("Authorization", `Bearer ${token}`)

		expect(res.status).toBe(200)
		expect(res.body.success).toBe(true)
		expect(res.body.data).toEqual([
			{ id: 1, name: "achievement.title-02", earned: false },
			{ id: 2, name: "achievement.title-06", earned: false },
			{ id: 3, name: "achievement.title-07", earned: false }
		])
	})

	it("returns 500 when the database query throws", async () => {
		const token = buildAccessToken(1, "session-ach-6")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 1 }))

		achievementFindManyMock.mockRejectedValueOnce(new Error("db down"))

		const res = await request(app)
			.get(`${PATH}?userId=1`)
			.set("Authorization", `Bearer ${token}`)

		expect(res.status).toBe(500)
		expect(res.body).toMatchObject({
			success: false,
			message: "achievement.messages.internal-server-error",
			status_code: 500
		})
	})
})
