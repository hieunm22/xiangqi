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

	it("returns 401 when refresh token cookie is missing", async () => {
		const res = await request(app).post(PATH)

		expect(res.status).toBe(401)
		expect(res.body).toMatchObject({
			success: false,
			message: "refresh-token.messages.missing-refresh-token",
			status_code: 401
		})
	})

	it("returns 401 when access token has no userId or sessionId", async () => {
		// malformed token without sub/jti
		const badToken = jwt.sign({ foo: "bar" }, process.env.JWT_SECRET as string, {
			issuer: process.env.JWT_ISSUER
		})

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${badToken}`)
			.set("Cookie", ["refresh-token=some-guid"])

		expect(res.status).toBe(401)
		expect(res.body).toMatchObject({
			success: false,
			message: "refresh-token.messages.mismatch-or-expired",
			status_code: 401
		})
	})

	it("returns 401 when refresh token cookie does not match cached value", async () => {
		const accessToken = jwt.sign(
			{ sub: 1, jti: "session-2", timezoneOffset: -420 },
			process.env.JWT_SECRET as string,
			{ issuer: process.env.JWT_ISSUER }
		)
		redisGetMock.mockResolvedValueOnce("different-guid")

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.set("Cookie", ["refresh-token=my-guid"])

		expect(res.status).toBe(401)
		expect(res.body).toMatchObject({
			success: false,
			message: "refresh-token.messages.mismatch-or-expired",
			status_code: 401
		})
	})

	it("returns 401 when refresh token is not in cache", async () => {
		const accessToken = jwt.sign(
			{ sub: 1, jti: "session-3", timezoneOffset: -420 },
			process.env.JWT_SECRET as string,
			{ issuer: process.env.JWT_ISSUER }
		)
		redisGetMock.mockResolvedValueOnce(null)

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.set("Cookie", ["refresh-token=my-guid"])

		expect(res.status).toBe(401)
		expect(res.body).toMatchObject({
			success: false,
			message: "refresh-token.messages.mismatch-or-expired",
			status_code: 401
		})
	})

	it("returns 200 and issues a new access token when all checks pass", async () => {
		const refreshGuid = "123e4567-e89b-12d3-a456-426614174000"
		const accessToken = jwt.sign(
			{ sub: 2, jti: "session-4", timezoneOffset: 0 },
			process.env.JWT_SECRET as string,
			{ issuer: process.env.JWT_ISSUER }
		)
		redisGetMock.mockResolvedValueOnce(refreshGuid)

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.set("Cookie", [`refresh-token=${refreshGuid}`])

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
		expect(newPayload.jti).toBe("session-4")
		expect(newPayload.timezoneOffset).toBe(0)
		// iat/exp should be fresh
		expect(newPayload.iat).toBeGreaterThan(0)
		expect(newPayload.exp).toBeGreaterThan(newPayload.iat!)
	})
})
