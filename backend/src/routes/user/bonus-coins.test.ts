import express from "express"
import jwt from "jsonwebtoken"
import request from "supertest"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import { AmountHistoryType } from "common/enums"

const redisGetMock = vi.fn()
const userFindUniqueMock = vi.fn()
const userUpdateMock = vi.fn()
const userAmountHistoryCreateMock = vi.fn()
const PATH = "/api/user/bonus-coins"
const CLAIM_PATH = "/api/user/bonus-coins-claim"

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

describe("bonus-coins routes", () => {
	let app: express.Express
	let consoleErrorSpy: ReturnType<typeof vi.spyOn>

	beforeAll(async () => {
		process.env.JWT_SECRET = "unit-test-secret"
		process.env.JWT_ISSUER = "unit-test-issuer"

		const { default: bonusCoinsRoutes } = await import("./bonus-coins")
		app = express()
		app.use(express.json())
		app.use("/api", bonusCoinsRoutes)
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

	// A slot boundary far in the past so the current slot is always newer.
	const OLD_SLOT = new Date("2000-01-01T00:00:00.000Z")
	// Far future is always >= the current slot.
	const FUTURE_SLOT = new Date("2999-01-01T00:00:00.000Z")
	const TOTAL_TREASURES = 7

	describe("GET /api/user/bonus-coins", () => {
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
			const accessToken = buildAccessToken(1, "session-bonus-1")
			redisGetMock.mockResolvedValue(JSON.stringify({ userId: 1 }))
			userFindUniqueMock.mockResolvedValue(null)

			const res = await request(app)
				.get(PATH)
				.set("Authorization", `Bearer ${accessToken}`)

			expect(res.status).toBe(404)
			expect(res.body).toMatchObject({
				success: false,
				message: "User not found",
				status_code: 404
			})
		})

		it("returns claimed=0 with pending=true when never claimed", async () => {
			const accessToken = buildAccessToken(2, "session-bonus-2")
			redisGetMock.mockResolvedValue(JSON.stringify({ userId: 2 }))
			userFindUniqueMock.mockResolvedValue({ bonus_claimed_count: 0, bonus_claimed_at: null })

			const res = await request(app)
				.get(PATH)
				.set("Authorization", `Bearer ${accessToken}`)

			expect(res.status).toBe(200)
			expect(res.body.data).toMatchObject({ claimed: 0, pending: true })
		})

		it("resets claimed to 0 when the last claim was in a previous slot", async () => {
			const accessToken = buildAccessToken(2, "session-bonus-2b")
			redisGetMock.mockResolvedValue(JSON.stringify({ userId: 2 }))
			userFindUniqueMock.mockResolvedValue({ bonus_claimed_count: 4, bonus_claimed_at: OLD_SLOT })

			const res = await request(app)
				.get(PATH)
				.set("Authorization", `Bearer ${accessToken}`)

			expect(res.status).toBe(200)
			expect(res.body.data).toMatchObject({ claimed: 0, pending: true })
		})

		it("returns the persisted count within the current slot", async () => {
			const accessToken = buildAccessToken(3, "session-bonus-3")
			redisGetMock.mockResolvedValue(JSON.stringify({ userId: 3 }))
			userFindUniqueMock.mockResolvedValue({ bonus_claimed_count: 3, bonus_claimed_at: FUTURE_SLOT })

			const res = await request(app)
				.get(PATH)
				.set("Authorization", `Bearer ${accessToken}`)

			expect(res.status).toBe(200)
			expect(res.body.data).toMatchObject({ claimed: 3, pending: true })
		})

		it("returns pending=false when all treasures are claimed this slot", async () => {
			const accessToken = buildAccessToken(3, "session-bonus-3b")
			redisGetMock.mockResolvedValue(JSON.stringify({ userId: 3 }))
			userFindUniqueMock.mockResolvedValue({
				bonus_claimed_count: TOTAL_TREASURES,
				bonus_claimed_at: FUTURE_SLOT
			})

			const res = await request(app)
				.get(PATH)
				.set("Authorization", `Bearer ${accessToken}`)

			expect(res.status).toBe(200)
			expect(res.body.data).toMatchObject({ claimed: TOTAL_TREASURES, pending: false })
		})

		it("returns 500 when a database error occurs", async () => {
			const accessToken = buildAccessToken(4, "session-bonus-4")
			redisGetMock.mockResolvedValue(JSON.stringify({ userId: 4 }))
			consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
			userFindUniqueMock.mockRejectedValue(new Error("db error"))

			const res = await request(app)
				.get(PATH)
				.set("Authorization", `Bearer ${accessToken}`)

			expect(res.status).toBe(500)
			expect(res.body).toMatchObject({
				success: false,
				message: "Internal server error",
				status_code: 500
			})
			expect(consoleErrorSpy).toHaveBeenCalledWith("Get bonus coins error:", expect.any(Error))
		})
	})

	describe("POST /api/user/bonus-coins-claim", () => {
		it("returns 401 when authorization token is missing", async () => {
			const res = await request(app).post(CLAIM_PATH)

			expect(res.status).toBe(401)
			expect(userUpdateMock).not.toHaveBeenCalled()
		})

		it("returns 404 when the user does not exist", async () => {
			const accessToken = buildAccessToken(5, "session-bonus-5")
			redisGetMock.mockResolvedValue(JSON.stringify({ userId: 5 }))
			userFindUniqueMock.mockResolvedValue(null)

			const res = await request(app)
				.post(CLAIM_PATH)
				.set("Authorization", `Bearer ${accessToken}`)

			expect(res.status).toBe(404)
			expect(res.body).toMatchObject({ message: "User not found", status_code: 404 })
			expect(userUpdateMock).not.toHaveBeenCalled()
		})

		it("claims the first treasure and credits its reward when never claimed", async () => {
			const accessToken = buildAccessToken(6, "session-bonus-6")
			redisGetMock.mockResolvedValue(JSON.stringify({ userId: 6 }))
			userFindUniqueMock.mockResolvedValue({ bonus_claimed_count: 0, bonus_claimed_at: null })
			userAmountHistoryCreateMock.mockResolvedValue({ id: BigInt(1) })
			userUpdateMock.mockResolvedValue({ bonus_claimed_count: 1 })

			const res = await request(app)
				.post(CLAIM_PATH)
				.set("Authorization", `Bearer ${accessToken}`)

			expect(res.status).toBe(200)
			expect(res.body.data).toMatchObject({ claimed: 1, reward: 800 })
			expect(userAmountHistoryCreateMock).toHaveBeenCalledWith(
				expect.objectContaining({
					data: {
						user_id: BigInt(6),
						amount: 800,
						type: AmountHistoryType.BonusCoin,
						created_at: expect.any(Date)
					}
				})
			)
			expect(userUpdateMock).toHaveBeenCalledWith(
				expect.objectContaining({
					where: { id: BigInt(6) },
					data: expect.objectContaining({
						bonus_claimed_count: 1,
						bonus_claimed_at: expect.any(Date),
						total_amount: { increment: 800 }
					})
				})
			)
		})

		it("claims the next treasure using the persisted count within the slot", async () => {
			const accessToken = buildAccessToken(7, "session-bonus-7")
			redisGetMock.mockResolvedValue(JSON.stringify({ userId: 7 }))
			userFindUniqueMock.mockResolvedValue({ bonus_claimed_count: 2, bonus_claimed_at: FUTURE_SLOT })
			userAmountHistoryCreateMock.mockResolvedValue({ id: BigInt(2) })
			userUpdateMock.mockResolvedValue({ bonus_claimed_count: 3 })

			const res = await request(app)
				.post(CLAIM_PATH)
				.set("Authorization", `Bearer ${accessToken}`)

			expect(res.status).toBe(200)
			// Index 2 reward is 1000.
			expect(res.body.data).toMatchObject({ claimed: 3, reward: 1000 })
			expect(userAmountHistoryCreateMock).toHaveBeenCalledWith(
				expect.objectContaining({
					data: expect.objectContaining({ amount: 1000, type: AmountHistoryType.BonusCoin })
				})
			)
		})

		it("resets and claims the first treasure when the stored claim is from a previous slot", async () => {
			const accessToken = buildAccessToken(8, "session-bonus-8")
			redisGetMock.mockResolvedValue(JSON.stringify({ userId: 8 }))
			userFindUniqueMock.mockResolvedValue({ bonus_claimed_count: 5, bonus_claimed_at: OLD_SLOT })
			userAmountHistoryCreateMock.mockResolvedValue({ id: BigInt(3) })
			userUpdateMock.mockResolvedValue({ bonus_claimed_count: 1 })

			const res = await request(app)
				.post(CLAIM_PATH)
				.set("Authorization", `Bearer ${accessToken}`)

			expect(res.status).toBe(200)
			expect(res.body.data).toMatchObject({ claimed: 1, reward: 800 })
		})

		it("returns 409 when all treasures are already claimed this slot", async () => {
			const accessToken = buildAccessToken(9, "session-bonus-9")
			redisGetMock.mockResolvedValue(JSON.stringify({ userId: 9 }))
			userFindUniqueMock.mockResolvedValue({
				bonus_claimed_count: TOTAL_TREASURES,
				bonus_claimed_at: FUTURE_SLOT
			})

			const res = await request(app)
				.post(CLAIM_PATH)
				.set("Authorization", `Bearer ${accessToken}`)

			expect(res.status).toBe(409)
			expect(res.body).toMatchObject({ message: "All treasures already claimed", status_code: 409 })
			expect(userAmountHistoryCreateMock).not.toHaveBeenCalled()
			expect(userUpdateMock).not.toHaveBeenCalled()
		})

		it("returns 500 when a database error occurs", async () => {
			const accessToken = buildAccessToken(10, "session-bonus-10")
			redisGetMock.mockResolvedValue(JSON.stringify({ userId: 10 }))
			consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
			userFindUniqueMock.mockRejectedValue(new Error("db error"))

			const res = await request(app)
				.post(CLAIM_PATH)
				.set("Authorization", `Bearer ${accessToken}`)

			expect(res.status).toBe(500)
			expect(consoleErrorSpy).toHaveBeenCalledWith("Claim bonus coin error:", expect.any(Error))
		})
	})
})
