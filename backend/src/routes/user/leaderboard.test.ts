import express from "express"
import jwt from "jsonwebtoken"
import request from "supertest"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"

const redisGetMock = vi.fn()
const userFindManyMock = vi.fn()

const PATH = "/api/user/leaderboard"

vi.mock("../../common/redis", () => ({
	default: {
		get: redisGetMock
	}
}))

vi.mock("prisma", () => ({
	default: {
		user: {
			findMany: userFindManyMock
		}
	}
}))

describe("GET /api/user/leaderboard", () => {
	let app: express.Express
	let consoleErrorSpy: ReturnType<typeof vi.spyOn>

	beforeAll(async () => {
		process.env.JWT_SECRET = "unit-test-secret"
		process.env.JWT_ISSUER = "unit-test-issuer"

		const { default: leaderboardRoutes } = await import("./leaderboard")
		app = express()
		app.use(express.json())
		app.use("/api", leaderboardRoutes)
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
		expect(userFindManyMock).not.toHaveBeenCalled()
	})

	it("returns 200 with the first page (default offset 0, limit 20) and excludes bots", async () => {
		const accessToken = buildAccessToken(1, "session-lb-1")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 1 }))

		userFindManyMock.mockResolvedValue([
			{ id: BigInt(101), display_name: "Alice", avatar_seq: 2, total_amount: 5000 },
			{ id: BigInt(102), display_name: "Bob", avatar_seq: 0, total_amount: 4000 }
		])

		const res = await request(app)
			.get(PATH)
			.set("Authorization", `Bearer ${accessToken}`)

		expect(res.status).toBe(200)
		expect(res.body).toMatchObject({
			success: true,
			message: "Success",
			status_code: 200,
			data: [
				{ id: 101, display_name: "Alice", avatar_url: "/images/101_2.jpg", total_amount: 5000 },
				{ id: 102, display_name: "Bob", avatar_url: "/images/102.jpg", total_amount: 4000 }
			]
		})
		expect(userFindManyMock).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { is_bot: false },
				orderBy: [
					{ total_amount: "desc" },
					{ display_name: "asc" }
				],
				skip: 0,
				take: 20,
				select: {
					id: true,
					display_name: true,
					avatar_seq: true,
					total_amount: true
				}
			})
		)
	})

	it("applies the provided offset and limit for paging", async () => {
		const accessToken = buildAccessToken(1, "session-lb-2")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 1 }))
		userFindManyMock.mockResolvedValue([])

		const res = await request(app)
			.get(`${PATH}?offset=40&limit=10`)
			.set("Authorization", `Bearer ${accessToken}`)

		expect(res.status).toBe(200)
		expect(res.body.data).toEqual([])
		expect(userFindManyMock).toHaveBeenCalledWith(
			expect.objectContaining({ skip: 40, take: 10 })
		)
	})

	it("clamps limit to the maximum page size of 50", async () => {
		const accessToken = buildAccessToken(1, "session-lb-3")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 1 }))
		userFindManyMock.mockResolvedValue([])

		const res = await request(app)
			.get(`${PATH}?offset=0&limit=500`)
			.set("Authorization", `Bearer ${accessToken}`)

		expect(res.status).toBe(200)
		expect(userFindManyMock).toHaveBeenCalledWith(
			expect.objectContaining({ skip: 0, take: 50 })
		)
	})

	it("falls back to defaults when offset and limit are invalid", async () => {
		const accessToken = buildAccessToken(1, "session-lb-4")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 1 }))
		userFindManyMock.mockResolvedValue([])

		const res = await request(app)
			.get(`${PATH}?offset=-5&limit=abc`)
			.set("Authorization", `Bearer ${accessToken}`)

		expect(res.status).toBe(200)
		expect(userFindManyMock).toHaveBeenCalledWith(
			expect.objectContaining({ skip: 0, take: 20 })
		)
	})

	it("returns 500 when an unexpected error happens", async () => {
		const accessToken = buildAccessToken(1, "session-lb-5")
		consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined)
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 1 }))
		userFindManyMock.mockRejectedValue(new Error("db down"))

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
