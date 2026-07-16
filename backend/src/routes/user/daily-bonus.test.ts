import express from "express"
import jwt from "jsonwebtoken"
import request from "supertest"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import { AmountHistoryType } from "common/enums"

const redisGetMock = vi.fn()
const userFindUniqueMock = vi.fn()
const userUpdateMock = vi.fn()
const userAmountHistoryCreateMock = vi.fn()
const PATH = "/api/user/daily-bonus"
const CLAIM_PATH = "/api/user/daily-bonus-claim"

vi.mock("../../common/redis", () => ({
	default: {
		get: redisGetMock
	}
}))

vi.mock("prisma", () => ({
	default: {
		user: {
			findUnique: userFindUniqueMock,
			update: userUpdateMock
		},
		userAmountHistory: {
			create: userAmountHistoryCreateMock
		},
		$transaction: vi.fn(async (callback) => {
			const tx = {
				user: {
					findUnique: userFindUniqueMock,
					update: userUpdateMock
				},
				userAmountHistory: {
					create: userAmountHistoryCreateMock
				}
			}
			return await callback(tx)
		})
	}
}))

describe("daily-bonus routes", () => {
	let app: express.Express
	let consoleErrorSpy: ReturnType<typeof vi.spyOn>

	beforeAll(async () => {
		process.env.JWT_SECRET = "unit-test-secret"
		process.env.JWT_ISSUER = "unit-test-issuer"

		const { default: dailyBonusRoutes } = await import("./daily-bonus")
		app = express()
		app.use(express.json())
		app.use("/api", dailyBonusRoutes)
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

	const TOTAL_DAYS = 7
	// Boundaries derived from the current UTC day so the streak logic is exercised
	// regardless of when the suite runs.
	const currentDayStart = () => {
		const day = new Date()
		day.setUTCHours(0, 0, 0, 0)
		return day
	}
	// A time inside the current day (already claimed today).
	const TODAY = new Date()
	// One second before today's 00:00 UTC → falls in the previous day.
	const yesterday = () => new Date(currentDayStart().getTime() - 1000)
	// Two full days back → a missed day.
	const twoDaysAgo = () => new Date(currentDayStart().getTime() - 2 * 24 * 60 * 60 * 1000)

	describe("GET /api/user/daily-bonus", () => {
		it("returns 401 when authorization token is missing", async () => {
			const res = await request(app).get(PATH)

			expect(res.status).toBe(401)
			expect(res.body).toMatchObject({
				success: false,
				message: "auth-middleware.messages.token-required",
				status_code: 401
			})
			expect(userFindUniqueMock).not.toHaveBeenCalled()
		})

		it("returns 404 when the user does not exist", async () => {
			const accessToken = buildAccessToken(1, "session-daily-1")
			redisGetMock.mockResolvedValue(JSON.stringify({ userId: 1 }))
			userFindUniqueMock.mockResolvedValue(null)

			const res = await request(app)
				.get(PATH)
				.set("Authorization", `Bearer ${accessToken}`)

			expect(res.status).toBe(404)
			expect(res.body).toMatchObject({ message: "User not found", status_code: 404 })
		})

		it("returns claimed=0 with canClaim=true when never claimed", async () => {
			const accessToken = buildAccessToken(2, "session-daily-2")
			redisGetMock.mockResolvedValue(JSON.stringify({ userId: 2 }))
			userFindUniqueMock.mockResolvedValue({ daily_claimed_count: 0, daily_claimed_at: null })

			const res = await request(app)
				.get(PATH)
				.set("Authorization", `Bearer ${accessToken}`)

			expect(res.status).toBe(200)
			expect(res.body.data).toMatchObject({ claimed: 0, canClaim: true })
		})

		it("keeps the streak but blocks claiming when already claimed today", async () => {
			const accessToken = buildAccessToken(3, "session-daily-3")
			redisGetMock.mockResolvedValue(JSON.stringify({ userId: 3 }))
			userFindUniqueMock.mockResolvedValue({ daily_claimed_count: 3, daily_claimed_at: TODAY })

			const res = await request(app)
				.get(PATH)
				.set("Authorization", `Bearer ${accessToken}`)

			expect(res.status).toBe(200)
			expect(res.body.data).toMatchObject({ claimed: 3, canClaim: false })
		})

		it("continues the streak when the last claim was yesterday", async () => {
			const accessToken = buildAccessToken(4, "session-daily-4")
			redisGetMock.mockResolvedValue(JSON.stringify({ userId: 4 }))
			userFindUniqueMock.mockResolvedValue({ daily_claimed_count: 3, daily_claimed_at: yesterday() })

			const res = await request(app)
				.get(PATH)
				.set("Authorization", `Bearer ${accessToken}`)

			expect(res.status).toBe(200)
			expect(res.body.data).toMatchObject({ claimed: 3, canClaim: true })
		})

		it("resets the streak when a day was missed", async () => {
			const accessToken = buildAccessToken(5, "session-daily-5")
			redisGetMock.mockResolvedValue(JSON.stringify({ userId: 5 }))
			userFindUniqueMock.mockResolvedValue({ daily_claimed_count: 4, daily_claimed_at: twoDaysAgo() })

			const res = await request(app)
				.get(PATH)
				.set("Authorization", `Bearer ${accessToken}`)

			expect(res.status).toBe(200)
			expect(res.body.data).toMatchObject({ claimed: 0, canClaim: true })
		})

		it("restarts after a completed 7-day streak", async () => {
			const accessToken = buildAccessToken(6, "session-daily-6")
			redisGetMock.mockResolvedValue(JSON.stringify({ userId: 6 }))
			userFindUniqueMock.mockResolvedValue({ daily_claimed_count: TOTAL_DAYS, daily_claimed_at: yesterday() })

			const res = await request(app)
				.get(PATH)
				.set("Authorization", `Bearer ${accessToken}`)

			expect(res.status).toBe(200)
			expect(res.body.data).toMatchObject({ claimed: 0, canClaim: true })
		})

		it("returns 500 when a database error occurs", async () => {
			const accessToken = buildAccessToken(7, "session-daily-7")
			redisGetMock.mockResolvedValue(JSON.stringify({ userId: 7 }))
			consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
			userFindUniqueMock.mockRejectedValue(new Error("db error"))

			const res = await request(app)
				.get(PATH)
				.set("Authorization", `Bearer ${accessToken}`)

			expect(res.status).toBe(500)
			expect(consoleErrorSpy).toHaveBeenCalledWith("Get daily bonus error:", expect.any(Error))
		})
	})

	describe("POST /api/user/daily-bonus-claim", () => {
		it("returns 401 when authorization token is missing", async () => {
			const res = await request(app).post(CLAIM_PATH)

			expect(res.status).toBe(401)
			expect(userUpdateMock).not.toHaveBeenCalled()
		})

		it("returns 404 when the user does not exist", async () => {
			const accessToken = buildAccessToken(8, "session-daily-8")
			redisGetMock.mockResolvedValue(JSON.stringify({ userId: 8 }))
			userFindUniqueMock.mockResolvedValue(null)

			const res = await request(app)
				.post(CLAIM_PATH)
				.set("Authorization", `Bearer ${accessToken}`)

			expect(res.status).toBe(404)
			expect(res.body).toMatchObject({ message: "User not found", status_code: 404 })
			expect(userUpdateMock).not.toHaveBeenCalled()
		})

		it("claims day 1 and credits its reward when never claimed", async () => {
			const accessToken = buildAccessToken(9, "session-daily-9")
			redisGetMock.mockResolvedValue(JSON.stringify({ userId: 9 }))
			userFindUniqueMock.mockResolvedValue({ daily_claimed_count: 0, daily_claimed_at: null })
			userAmountHistoryCreateMock.mockResolvedValue({ id: BigInt(1) })
			userUpdateMock.mockResolvedValue({ daily_claimed_count: 1 })

			const res = await request(app)
				.post(CLAIM_PATH)
				.set("Authorization", `Bearer ${accessToken}`)

			expect(res.status).toBe(200)
			expect(res.body.data).toMatchObject({ claimed: 1, reward: 1000 })
			expect(userAmountHistoryCreateMock).toHaveBeenCalledWith(
				expect.objectContaining({
					data: {
						user_id: BigInt(9),
						amount: 1000,
						type: AmountHistoryType.DailyBonusNormal,
						created_at: expect.any(Date)
					}
				})
			)
			expect(userUpdateMock).toHaveBeenCalledWith(
				expect.objectContaining({
					where: { id: BigInt(9) },
					data: expect.objectContaining({
						daily_claimed_count: 1,
						daily_claimed_at: expect.any(Date),
						total_amount: { increment: 1000 }
					})
				})
			)
		})

		it("doubles the reward when claimed with the double flag (watch video)", async () => {
			const accessToken = buildAccessToken(14, "session-daily-14")
			redisGetMock.mockResolvedValue(JSON.stringify({ userId: 14 }))
			userFindUniqueMock.mockResolvedValue({ daily_claimed_count: 0, daily_claimed_at: null })
			userAmountHistoryCreateMock.mockResolvedValue({ id: BigInt(4) })
			userUpdateMock.mockResolvedValue({ daily_claimed_count: 1 })

			const res = await request(app)
				.post(CLAIM_PATH)
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ double: true })

			expect(res.status).toBe(200)
			// Day index 0 reward 1000, doubled via watch video.
			expect(res.body.data).toMatchObject({ claimed: 1, reward: 2000 })
			expect(userAmountHistoryCreateMock).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({ amount: 2000, type: AmountHistoryType.DailyBonusDouble })
				})
			)
			expect(userUpdateMock).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({ total_amount: { increment: 2000 } })
				})
			)
		})

		it("claims the next day continuing yesterday's streak", async () => {
			const accessToken = buildAccessToken(10, "session-daily-10")
			redisGetMock.mockResolvedValue(JSON.stringify({ userId: 10 }))
			userFindUniqueMock.mockResolvedValue({ daily_claimed_count: 2, daily_claimed_at: yesterday() })
			userAmountHistoryCreateMock.mockResolvedValue({ id: BigInt(2) })
			userUpdateMock.mockResolvedValue({ daily_claimed_count: 3 })

			const res = await request(app)
				.post(CLAIM_PATH)
				.set("Authorization", `Bearer ${accessToken}`)

			expect(res.status).toBe(200)
			// Day index 2 reward is 1400.
			expect(res.body.data).toMatchObject({ claimed: 3, reward: 1400 })
		})

		it("claims day 1 after a missed day resets the streak", async () => {
			const accessToken = buildAccessToken(11, "session-daily-11")
			redisGetMock.mockResolvedValue(JSON.stringify({ userId: 11 }))
			userFindUniqueMock.mockResolvedValue({ daily_claimed_count: 5, daily_claimed_at: twoDaysAgo() })
			userAmountHistoryCreateMock.mockResolvedValue({ id: BigInt(3) })
			userUpdateMock.mockResolvedValue({ daily_claimed_count: 1 })

			const res = await request(app)
				.post(CLAIM_PATH)
				.set("Authorization", `Bearer ${accessToken}`)

			expect(res.status).toBe(200)
			expect(res.body.data).toMatchObject({ claimed: 1, reward: 1000 })
		})

		it("returns 409 when today's chest was already claimed", async () => {
			const accessToken = buildAccessToken(12, "session-daily-12")
			redisGetMock.mockResolvedValue(JSON.stringify({ userId: 12 }))
			userFindUniqueMock.mockResolvedValue({ daily_claimed_count: 3, daily_claimed_at: TODAY })

			const res = await request(app)
				.post(CLAIM_PATH)
				.set("Authorization", `Bearer ${accessToken}`)

			expect(res.status).toBe(409)
			expect(res.body).toMatchObject({ message: "Already claimed today", status_code: 409 })
			expect(userAmountHistoryCreateMock).not.toHaveBeenCalled()
			expect(userUpdateMock).not.toHaveBeenCalled()
		})

		it("returns 500 when a database error occurs", async () => {
			const accessToken = buildAccessToken(13, "session-daily-13")
			redisGetMock.mockResolvedValue(JSON.stringify({ userId: 13 }))
			consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
			userFindUniqueMock.mockRejectedValue(new Error("db error"))

			const res = await request(app)
				.post(CLAIM_PATH)
				.set("Authorization", `Bearer ${accessToken}`)

			expect(res.status).toBe(500)
			expect(consoleErrorSpy).toHaveBeenCalledWith("Claim daily bonus error:", expect.any(Error))
		})
	})
})
