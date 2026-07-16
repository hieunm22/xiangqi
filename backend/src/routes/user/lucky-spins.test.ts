import express from "express"
import jwt from "jsonwebtoken"
import request from "supertest"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import { AmountHistoryType } from "common/enums"

const redisGetMock = vi.fn()
const userFindUniqueMock = vi.fn()
const userUpdateMock = vi.fn()
const userAmountHistoryCreateMock = vi.fn()
const PATH = "/api/user/lucky-spins"
const CLAIM_PATH = "/api/user/lucky-spins-claim"
const SPIN_PATH = "/api/user/lucky-spin"

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

describe("lucky-spins routes", () => {
	let app: express.Express
	let consoleErrorSpy: ReturnType<typeof vi.spyOn>

	beforeAll(async () => {
		process.env.JWT_SECRET = "unit-test-secret"
		process.env.JWT_ISSUER = "unit-test-issuer"

		const { default: luckySpinsRoutes } = await import("./lucky-spins")
		app = express()
		app.use(express.json())
		app.use("/api", luckySpinsRoutes)
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

	describe("GET /api/user/lucky-spins", () => {
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
			const accessToken = buildAccessToken(1, "session-spins-1")
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

		it("returns spins with pending=true when never claimed", async () => {
			const accessToken = buildAccessToken(2, "session-spins-2")
			redisGetMock.mockResolvedValue(JSON.stringify({ userId: 2 }))
			userFindUniqueMock.mockResolvedValue({ lucky_spins: 2, lucky_claimed_at: null })

			const res = await request(app)
				.get(PATH)
				.set("Authorization", `Bearer ${accessToken}`)

			expect(res.status).toBe(200)
			expect(res.body.data).toMatchObject({ spins: 2, pending: true })
		})

		it("returns pending=true when the last claim was in a previous slot", async () => {
			const accessToken = buildAccessToken(2, "session-spins-2b")
			redisGetMock.mockResolvedValue(JSON.stringify({ userId: 2 }))
			userFindUniqueMock.mockResolvedValue({ lucky_spins: 1, lucky_claimed_at: OLD_SLOT })

			const res = await request(app)
				.get(PATH)
				.set("Authorization", `Bearer ${accessToken}`)

			expect(res.status).toBe(200)
			expect(res.body.data).toMatchObject({ spins: 1, pending: true })
		})

		it("returns pending=false when already claimed for the current slot", async () => {
			const accessToken = buildAccessToken(3, "session-spins-3")
			redisGetMock.mockResolvedValue(JSON.stringify({ userId: 3 }))
			// Claim timestamp in the far future is always >= current slot.
			userFindUniqueMock.mockResolvedValue({
				lucky_spins: 5,
				lucky_claimed_at: new Date("2999-01-01T00:00:00.000Z")
			})

			const res = await request(app)
				.get(PATH)
				.set("Authorization", `Bearer ${accessToken}`)

			expect(res.status).toBe(200)
			expect(res.body.data).toMatchObject({ spins: 5, pending: false })
		})

		it("returns 500 when a database error occurs", async () => {
			const accessToken = buildAccessToken(4, "session-spins-4")
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
			expect(consoleErrorSpy).toHaveBeenCalledWith("Get lucky spins error:", expect.any(Error))
		})
	})

	describe("POST /api/user/lucky-spins-claim", () => {
		it("returns 401 when authorization token is missing", async () => {
			const res = await request(app).post(CLAIM_PATH)

			expect(res.status).toBe(401)
			expect(userUpdateMock).not.toHaveBeenCalled()
		})

		it("returns 404 when the user does not exist", async () => {
			const accessToken = buildAccessToken(5, "session-spins-5")
			redisGetMock.mockResolvedValue(JSON.stringify({ userId: 5 }))
			userFindUniqueMock.mockResolvedValue(null)

			const res = await request(app)
				.post(CLAIM_PATH)
				.set("Authorization", `Bearer ${accessToken}`)

			expect(res.status).toBe(404)
			expect(res.body).toMatchObject({ message: "User not found", status_code: 404 })
			expect(userUpdateMock).not.toHaveBeenCalled()
		})

		it("grants +3 spins when a slot bonus is pending", async () => {
			const accessToken = buildAccessToken(6, "session-spins-6")
			redisGetMock.mockResolvedValue(JSON.stringify({ userId: 6 }))
			userFindUniqueMock.mockResolvedValue({ lucky_spins: 2, lucky_claimed_at: OLD_SLOT })
			userUpdateMock.mockResolvedValue({ lucky_spins: 5 })

			const res = await request(app)
				.post(CLAIM_PATH)
				.set("Authorization", `Bearer ${accessToken}`)

			expect(res.status).toBe(200)
			expect(res.body.data).toMatchObject({ spins: 5, pending: false })
			expect(userUpdateMock).toHaveBeenCalledWith(
				expect.objectContaining({
					where: { id: BigInt(6) },
					data: expect.objectContaining({
						lucky_spins: { increment: 3 },
						lucky_claimed_at: expect.any(Date)
					})
				})
			)
		})

		it("does not grant again when already claimed for the current slot", async () => {
			const accessToken = buildAccessToken(7, "session-spins-7")
			redisGetMock.mockResolvedValue(JSON.stringify({ userId: 7 }))
			userFindUniqueMock.mockResolvedValue({
				lucky_spins: 5,
				lucky_claimed_at: new Date("2999-01-01T00:00:00.000Z")
			})

			const res = await request(app)
				.post(CLAIM_PATH)
				.set("Authorization", `Bearer ${accessToken}`)

			expect(res.status).toBe(200)
			expect(res.body.data).toMatchObject({ spins: 5, pending: false })
			expect(userUpdateMock).not.toHaveBeenCalled()
		})

		it("returns 500 when a database error occurs", async () => {
			const accessToken = buildAccessToken(8, "session-spins-8")
			redisGetMock.mockResolvedValue(JSON.stringify({ userId: 8 }))
			consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
			userFindUniqueMock.mockRejectedValue(new Error("db error"))

			const res = await request(app)
				.post(CLAIM_PATH)
				.set("Authorization", `Bearer ${accessToken}`)

			expect(res.status).toBe(500)
			expect(consoleErrorSpy).toHaveBeenCalledWith("Claim lucky spins error:", expect.any(Error))
		})
	})

	describe("POST /api/user/lucky-spin", () => {
		it("returns 401 when authorization token is missing", async () => {
			const res = await request(app).post(SPIN_PATH).send({ amount: 100 })

			expect(res.status).toBe(401)
			expect(userUpdateMock).not.toHaveBeenCalled()
		})

		it("returns 400 when amount parameter is missing", async () => {
			const accessToken = buildAccessToken(9, "session-spins-9a")
			redisGetMock.mockResolvedValue(JSON.stringify({ userId: 9 }))

			const res = await request(app)
				.post(SPIN_PATH)
				.set("Authorization", `Bearer ${accessToken}`)
				.send({})

			expect(res.status).toBe(400)
			expect(res.body).toMatchObject({ message: "Amount parameter is required", status_code: 400 })
			expect(userFindUniqueMock).not.toHaveBeenCalled()
			expect(userUpdateMock).not.toHaveBeenCalled()
		})

		it("returns 400 when amount parameter is null", async () => {
			const accessToken = buildAccessToken(9, "session-spins-9c")
			redisGetMock.mockResolvedValue(JSON.stringify({ userId: 9 }))

			const res = await request(app)
				.post(SPIN_PATH)
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ amount: null })

			expect(res.status).toBe(400)
			expect(res.body).toMatchObject({ message: "Amount parameter is required", status_code: 400 })
			expect(userFindUniqueMock).not.toHaveBeenCalled()
			expect(userUpdateMock).not.toHaveBeenCalled()
		})

		it("returns 400 when amount is not an integer", async () => {
			const accessToken = buildAccessToken(9, "session-spins-9b")
			redisGetMock.mockResolvedValue(JSON.stringify({ userId: 9 }))

			const res = await request(app)
				.post(SPIN_PATH)
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ amount: 12.5 })

			expect(res.status).toBe(400)
			expect(res.body).toMatchObject({ message: "Amount must be an integer", status_code: 400 })
			expect(userFindUniqueMock).not.toHaveBeenCalled()
			expect(userUpdateMock).not.toHaveBeenCalled()
		})

		it("returns 404 when the user does not exist", async () => {
			const accessToken = buildAccessToken(9, "session-spins-9")
			redisGetMock.mockResolvedValue(JSON.stringify({ userId: 9 }))
			userFindUniqueMock.mockResolvedValue(null)

			const res = await request(app)
				.post(SPIN_PATH)
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ amount: 100 })

			expect(res.status).toBe(404)
			expect(res.body).toMatchObject({ message: "User not found", status_code: 404 })
			expect(userUpdateMock).not.toHaveBeenCalled()
		})

		it("returns 409 when the user has no spins remaining", async () => {
			const accessToken = buildAccessToken(10, "session-spins-10")
			redisGetMock.mockResolvedValue(JSON.stringify({ userId: 10 }))
			userFindUniqueMock.mockResolvedValue({ lucky_spins: 0 })

			const res = await request(app)
				.post(SPIN_PATH)
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ amount: 100 })

			expect(res.status).toBe(409)
			expect(res.body).toMatchObject({ message: "No spins remaining", status_code: 409 })
			expect(userAmountHistoryCreateMock).not.toHaveBeenCalled()
			expect(userUpdateMock).not.toHaveBeenCalled()
		})

		it("consumes one spin and credits the reward in a single transaction", async () => {
			const accessToken = buildAccessToken(11, "session-spins-11")
			redisGetMock.mockResolvedValue(JSON.stringify({ userId: 11 }))
			userFindUniqueMock.mockResolvedValue({ lucky_spins: 3 })
			userAmountHistoryCreateMock.mockResolvedValue({ id: BigInt(1) })
			userUpdateMock.mockResolvedValue({ lucky_spins: 2 })

			const res = await request(app)
				.post(SPIN_PATH)
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ amount: 150 })

			expect(res.status).toBe(200)
			expect(res.body.data).toMatchObject({ spins: 2 })
			expect(userAmountHistoryCreateMock).toHaveBeenCalledWith(
				expect.objectContaining({
					data: {
						user_id: BigInt(11),
						amount: 150,
						type: AmountHistoryType.LuckyWheel,
						created_at: expect.any(Date)
					}
				})
			)
			expect(userUpdateMock).toHaveBeenCalledWith(
				expect.objectContaining({
					where: { id: BigInt(11) },
					data: {
						lucky_spins: { decrement: 1 },
						total_amount: { increment: 150 }
					}
				})
			)
		})

		it("returns 500 when a database error occurs", async () => {
			const accessToken = buildAccessToken(12, "session-spins-12")
			redisGetMock.mockResolvedValue(JSON.stringify({ userId: 12 }))
			consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
			userFindUniqueMock.mockRejectedValue(new Error("db error"))

			const res = await request(app)
				.post(SPIN_PATH)
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ amount: 100 })

			expect(res.status).toBe(500)
			expect(consoleErrorSpy).toHaveBeenCalledWith("Consume lucky spin error:", expect.any(Error))
		})
	})
})
