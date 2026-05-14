import express from "express"
import jwt from "jsonwebtoken"
import request from "supertest"
import cookieParser from "cookie-parser"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"

const redisGetMock = vi.fn()
const PATH = "/api/auth/validate-token"

vi.mock("../../common/redis", () => ({
	default: {
		get: redisGetMock
	}
}))

describe("POST /api/auth/validate-token", () => {
	let app: express.Express
	let verifySpy: ReturnType<typeof vi.spyOn> | undefined

	beforeAll(async () => {
		process.env.JWT_SECRET = "unit-test-secret"
		process.env.JWT_ISSUER = "unit-test-issuer"
		process.env.NODE_ENV = "test"

		const { default: validateTokenRoutes } = await import("./validate-token")
		app = express()
		app.use(express.json())
		app.use(cookieParser())
		app.use("/api", validateTokenRoutes)
	})

	afterEach(() => {
		vi.clearAllMocks()
		verifySpy?.mockRestore()
		verifySpy = undefined
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
			{ sub: 1, jti: "session-validate-1" },
			process.env.JWT_SECRET as string,
			{ issuer: process.env.JWT_ISSUER, expiresIn: "1h" }
		)
		redisGetMock.mockResolvedValue(null)

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)

		expect(res.status).toBe(401)
		expect(res.body).toMatchObject({
			success: false,
			message: "auth-middleware.messages.session-not-found",
			status_code: 401
		})
	})

	it("returns 401 when token payload is missing subject or session id", async () => {
		const accessToken = jwt.sign(
			{ sub: 1 },
			process.env.JWT_SECRET as string,
			{ issuer: process.env.JWT_ISSUER, expiresIn: "1h" }
		)

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)

		expect(res.status).toBe(401)
		expect(res.body).toMatchObject({
			success: false,
			message: "auth-middleware.messages.invalid-token-payload",
			status_code: 401
		})
	})

	it("returns 401 when token subject does not match cached session", async () => {
		const accessToken = jwt.sign(
			{ sub: 3, jti: "session-validate-3" },
			process.env.JWT_SECRET as string,
			{ issuer: process.env.JWT_ISSUER, expiresIn: "1h" }
		)
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 99 }))

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)

		expect(res.status).toBe(401)
		expect(res.body).toMatchObject({
			success: false,
			message: "auth-middleware.messages.token-subject-mismatch",
			status_code: 401
		})
	})

	it("returns 401 when token is expired", async () => {
		const accessToken = jwt.sign(
			{ sub: 4, jti: "session-validate-4" },
			process.env.JWT_SECRET as string,
			{ issuer: process.env.JWT_ISSUER, expiresIn: "-1s" }
		)

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)

		expect(res.status).toBe(401)
		expect(res.body).toMatchObject({
			success: false,
			message: "auth-middleware.messages.token-expired",
			status_code: 401
		})
	})

	it("returns 401 when token is invalid", async () => {
		const res = await request(app)
			.post(PATH)
			.set("Authorization", "Bearer not-a-valid-jwt")

		expect(res.status).toBe(401)
		expect(res.body).toMatchObject({
			success: false,
			message: "auth-middleware.messages.token-invalid",
			status_code: 401
		})
	})

	it("returns 401 when token validation fails unexpectedly", async () => {
		verifySpy = vi.spyOn(jwt, "verify").mockImplementation(() => {
			throw new Error("unexpected verification failure")
		})

		const res = await request(app)
			.post(PATH)
			.set("Authorization", "Bearer any-token")

		expect(res.status).toBe(401)
		expect(res.body).toMatchObject({
			success: false,
			message: "auth-middleware.messages.token-validation-failed",
			status_code: 401
		})
	})

	it("returns 200 when token is valid and session exists", async () => {
		const accessToken = jwt.sign(
			{ sub: 2, jti: "session-validate-2" },
			process.env.JWT_SECRET as string,
			{ issuer: process.env.JWT_ISSUER, expiresIn: "1h" }
		)
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 2 }))

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)

		expect(res.status).toBe(200)
		expect(res.body).toMatchObject({
			success: true,
			message: "validate-token.messages.success",
			status_code: 200
		})
	})
})