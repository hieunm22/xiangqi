import express from "express"
import jwt from "jsonwebtoken"
import request from "supertest"
import cookieParser from "cookie-parser"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"

const redisGetMock = vi.fn()
const PATH = "/api/auth/refresh-token"

vi.mock("../../common/redis", () => ({
	default: {
		get: redisGetMock
	}
}))

describe("POST /api/auth/refresh-token", () => {
	let app: express.Express

	beforeAll(async () => {
		process.env.JWT_SECRET = "unit-test-secret"
		process.env.JWT_ISSUER = "unit-test-issuer"
		process.env.NODE_ENV = "test"

		const { default: refreshTokenRoutes } = await import("./refresh-token")
		app = express()
		app.use(express.json())
		app.use(cookieParser())
		app.use("/api", refreshTokenRoutes)
	})

	afterEach(() => {
		vi.clearAllMocks()
	})

	it("returns 401 when authorization token is missing", async () => {
		const res = await request(app).post(PATH)

		expect(res.status).toBe(401)
		expect(res.body).toMatchObject({
			success: false,
			message: "auth-middleware.messages.token-required",
			status_code: 401
		})
	})

	it("returns 401 when session is not found in cache", async () => {
		const accessToken = jwt.sign(
			{ sub: 1, jti: "session-1", timezoneOffset: -420 },
			process.env.JWT_SECRET as string,
			{ issuer: process.env.JWT_ISSUER, expiresIn: "1h" }
		)
		redisGetMock.mockResolvedValue(null)

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.set("Cookie", ["refresh-token=refresh-abc"])

		expect(res.status).toBe(401)
		expect(res.body).toMatchObject({
			success: false,
			message: "auth-middleware.messages.session-not-found",
			status_code: 401
		})
	})

	it("returns 401 when refresh token cookie is missing", async () => {
		const accessToken = jwt.sign(
			{ sub: 1, jti: "session-2", timezoneOffset: -420 },
			process.env.JWT_SECRET as string,
			{ issuer: process.env.JWT_ISSUER, expiresIn: "1h" }
		)
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 1 }))

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)

		expect(res.status).toBe(401)
		expect(res.body).toMatchObject({
			success: false,
			message: "refresh-token.messages.missing-refresh-token",
			status_code: 401
		})
	})

	it("returns 200 and issues a new access token when auth and refresh cookie are valid", async () => {
		const accessToken = jwt.sign(
			{ sub: 2, jti: "session-3", timezoneOffset: 0 },
			process.env.JWT_SECRET as string,
			{ issuer: process.env.JWT_ISSUER, expiresIn: "1h" }
		)
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 2 }))

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.set("Cookie", ["refresh-token=refresh-xyz"])

		expect(res.status).toBe(200)
		expect(res.body).toMatchObject({
			success: true,
			message: "refresh-token.messages.success",
			status_code: 200,
			token_type: "Bearer"
		})
		expect(typeof res.body.access_token).toBe("string")

		const newPayload = jwt.verify(res.body.access_token, process.env.JWT_SECRET as string, {
			issuer: process.env.JWT_ISSUER
		}) as jwt.JwtPayload
		expect(Number(newPayload.sub)).toBe(2)
		expect(newPayload.jti).toBe("session-3")
		expect(newPayload.timezoneOffset).toBe(0)
	})
})
