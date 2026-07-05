import express from "express"
import jwt from "jsonwebtoken"
import request from "supertest"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"

const redisGetMock = vi.fn()
const userFindUniqueMock = vi.fn()
const gameUserFindManyMock = vi.fn()

const PATH = "/api/auth/user"

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
		gameUser: {
			findMany: gameUserFindManyMock
		}
	}
}))

describe("GET /api/auth/user?id=:id", () => {
	let app: express.Express
	let consoleErrorSpy: ReturnType<typeof vi.spyOn>

	beforeAll(async () => {
		process.env.JWT_SECRET = "unit-test-secret"
		process.env.JWT_ISSUER = "unit-test-issuer"

		const { default: getUserRoutes } = await import("./get-user")
		app = express()
		app.use(express.json())
		app.use("/api", getUserRoutes)
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
		const res = await request(app).get(`${PATH}?id=101`)

		expect(res.status).toBe(401)
		expect(res.body).toMatchObject({
			success: false,
			message: "auth-middleware.messages.token-required",
			status_code: 401
		})
		expect(userFindUniqueMock).not.toHaveBeenCalled()
	})

	it("returns 400 when user id is missing", async () => {
		const accessToken = buildAccessToken(11, "session-user-1")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 11 }))

		const res = await request(app)
			.get(PATH)
			.set("Authorization", `Bearer ${accessToken}`)

		expect(res.status).toBe(400)
		expect(res.body).toMatchObject({
			success: false,
			message: "Invalid user ID",
			status_code: 400
		})
		expect(userFindUniqueMock).not.toHaveBeenCalled()
	})

	it("returns 400 when user id is invalid", async () => {
		const accessToken = buildAccessToken(11, "session-user-2")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 11 }))

		const res = await request(app)
			.get(`${PATH}?id=abc`)
			.set("Authorization", `Bearer ${accessToken}`)

		expect(res.status).toBe(400)
		expect(res.body).toMatchObject({
			success: false,
			message: "Invalid user ID",
			status_code: 400
		})
		expect(userFindUniqueMock).not.toHaveBeenCalled()
	})

	it("returns 404 when user is not found", async () => {
		const accessToken = buildAccessToken(11, "session-user-3")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 11 }))
		userFindUniqueMock.mockResolvedValue(null)

		const res = await request(app)
			.get(`${PATH}?id=101`)
			.set("Authorization", `Bearer ${accessToken}`)

		expect(res.status).toBe(404)
		expect(res.body).toMatchObject({
			success: false,
			message: "User not found",
			status_code: 404
		})
		expect(userFindUniqueMock).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { id: 101 },
				select: expect.objectContaining({
					id: true,
					user_name: true,
					email: true,
					display_name: true,
					gender: true,
					avatar_seq: true,
					total_amount: true
				})
			})
		)
	})

	it("returns 200 and user data with games statistics when user exists", async () => {
		const accessToken = buildAccessToken(11, "session-user-4")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 11 }))

		userFindUniqueMock.mockResolvedValue({
			id: BigInt(101),
			user_name: "alice",
			email: "alice@example.com",
			display_name: "Alice",
			gender: true,
			avatar_seq: 2,
			total_amount: 250
		})

		gameUserFindManyMock.mockResolvedValue([
			{ game_id: "game-1", user_id: 101, amount: 10 }, // win
			{ game_id: "game-2", user_id: 101, amount: 5 }, // win
			{ game_id: "game-3", user_id: 101, amount: 0 }, // draw
			{ game_id: "game-4", user_id: 101, amount: -5 }, // lose
			{ game_id: "game-5", user_id: 101, amount: -10 } // lose
		])

		const res = await request(app)
			.get(`${PATH}?id=101`)
			.set("Authorization", `Bearer ${accessToken}`)

		expect(res.status).toBe(200)
		expect(res.body).toMatchObject({
			success: true,
			status_code: 200,
			data: {
				user: {
					id: 101,
					user_name: "alice",
					email: "alice@example.com",
					display_name: "Alice",
					gender: true,
					avatar_url: "/images/101_2.jpg",
					total_amount: 250
				},
				stats: {
					win: 2,
					draw: 1,
					lose: 2
				}
			}
		})
	
		expect(gameUserFindManyMock).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { user_id: 101 }
			})
		)
	})

	it("returns 500 when unexpected error happens", async () => {
		const accessToken = buildAccessToken(11, "session-user-5")
		consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined)
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 11 }))
		userFindUniqueMock.mockRejectedValue(new Error("db down"))

		const res = await request(app)
			.get(`${PATH}?id=101`)
			.set("Authorization", `Bearer ${accessToken}`)

		expect(res.status).toBe(500)
		expect(res.body).toMatchObject({
			success: false,
			message: "Internal server error",
			status_code: 500
		})
	})

	it("returns 200 with empty games when user has no games", async () => {
		const accessToken = buildAccessToken(11, "session-user-6")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 11 }))

		userFindUniqueMock.mockResolvedValue({
			id: BigInt(102),
			user_name: "bob",
			email: "bob@example.com",
			display_name: "Bob",
			gender: false,
			avatar_seq: 1,
			total_amount: 0
		})

		gameUserFindManyMock.mockResolvedValue([])

		const res = await request(app)
			.get(`${PATH}?id=102`)
			.set("Authorization", `Bearer ${accessToken}`)

		expect(res.status).toBe(200)
		expect(res.body).toMatchObject({
			success: true,
			status_code: 200,
			data: {
				user: {
					id: 102,
					user_name: "bob",
					email: "bob@example.com",
					display_name: "Bob",
					gender: false,
					avatar_url: "/images/102_1.jpg",
					total_amount: 0
				},
				stats: {
					win: 0,
					draw: 0,
					lose: 0
				}
			}
		})
	})
})
