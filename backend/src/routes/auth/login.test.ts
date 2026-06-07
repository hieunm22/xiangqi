import express from "express"
import jwt from "jsonwebtoken"
import request from "supertest"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import { REFRESH_TOKEN_TTL_SECONDS } from "common/constant"

const prismaFindFirstMock = vi.fn()
const redisSetMock = vi.fn()
const PATH = "/api/auth/login"

vi.mock("prisma", () => ({
	default: {
		user: {
			findFirst: prismaFindFirstMock
		}
	}
}))

vi.mock("../../common/redis", () => ({
	default: {
		set: redisSetMock
	}
}))

describe("POST /api/auth/login", () => {
	let app: express.Express
	let consoleErrorSpy: ReturnType<typeof vi.spyOn>

	beforeAll(async () => {
		process.env.JWT_SECRET = "unit-test-secret"
		process.env.JWT_ISSUER = "unit-test-issuer"
		process.env.NODE_ENV = "test"

		const { default: loginRoutes } = await import("./login")
		app = express()
		app.use("/api", loginRoutes)
	})

	afterEach(() => {
		vi.clearAllMocks()
		consoleErrorSpy?.mockRestore()
	})

	it("returns 400 when username or password is missing", async () => {
		const res = await request(app)
			.post(PATH)
			.field("username", "")
			.field("password", "")

		expect(res.status).toBe(400)
		expect(res.body).toMatchObject({
			success: false,
			message: "login.messages.missing-credentials",
			status_code: 400
		})
		expect(prismaFindFirstMock).not.toHaveBeenCalled()
	})

	it("returns 401 when credentials are invalid", async () => {
		prismaFindFirstMock.mockResolvedValue(null)

		const res = await request(app)
			.post(PATH)
			.field("username", "unknown")
			.field("password", "wrong")

		expect(res.status).toBe(401)
		expect(res.body).toMatchObject({
			success: false,
			message: "login.messages.incorrect-login",
			status_code: 401
		})
		expect(redisSetMock).not.toHaveBeenCalled()
	})

	it("returns 200 and persists session when credentials are valid", async () => {
		prismaFindFirstMock.mockResolvedValue({ id: 1, user_name: "alice" })

		const res = await request(app)
			.post(PATH)
			.field("username", "alice")
			.field("password", "correct-password")
			.field("timezoneOffset", "-420")
			.field("deviceName", "Chrome on Windows")

		expect(res.status).toBe(200)
		expect(res.body).toMatchObject({
			success: true,
			message: "login.messages.success",
			status_code: 200,
			token_type: "Bearer"
		})
		expect(typeof res.body.access_token).toBe("string")
		expect(typeof res.body.refresh_token).toBe("string")

		const payload = jwt.verify(res.body.access_token, process.env.JWT_SECRET as string, {
			issuer: process.env.JWT_ISSUER
		}) as jwt.JwtPayload
		expect(Number(payload.sub)).toBe(1)
		expect(typeof payload.jti).toBe("string")
		expect(payload.timezoneOffset).toBe(-420)

		expect(redisSetMock).toHaveBeenCalledTimes(2)
		const [sessionKey, sessionRaw, expiryMode, ttl] = redisSetMock.mock.calls[0]
		expect(sessionKey).toMatch(/^login-session:1:/)
		expect(expiryMode).toBe("EX")
		expect(ttl).toBe(REFRESH_TOKEN_TTL_SECONDS)

		const [refreshKey, refreshValue, refreshExpiryMode, refreshTtl] = redisSetMock.mock.calls[1]
		expect(refreshKey).toMatch(/^refresh-token:1:/)
		expect(refreshExpiryMode).toBe("EX")
		expect(refreshTtl).toBe(REFRESH_TOKEN_TTL_SECONDS)
		expect(refreshValue).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
		expect(res.body.refresh_token).toBe(refreshValue)

		const sessionValue = JSON.parse(sessionRaw as string)
		expect(sessionValue).toMatchObject({
			userId: 1,
			deviceName: "Chrome on Windows",
			isValid: true
		})

		const setCookieHeader = res.headers["set-cookie"]
		const serializedCookies = Array.isArray(setCookieHeader)
			? setCookieHeader.join(";")
			: String(setCookieHeader ?? "")
		expect(serializedCookies).toContain("refresh-token=")
		expect(serializedCookies).toContain("HttpOnly")
	})

	it("supports application/x-www-form-urlencoded requests", async () => {
		prismaFindFirstMock.mockResolvedValue({ id: 2, user_name: "bob" })

		const res = await request(app)
			.post(PATH)
			.type("form")
			.send({
				username: "bob",
				password: "correct-password",
				timezoneOffset: 0,
				deviceName: "Firefox"
			})

		expect(res.status).toBe(200)
		expect(res.body.success).toBe(true)
		expect(prismaFindFirstMock).toHaveBeenCalledTimes(1)
	})

	it("returns 500 when unexpected error happens", async () => {
		consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined)
		prismaFindFirstMock.mockRejectedValue(new Error("db down"))

		const res = await request(app)
			.post(PATH)
			.field("username", "alice")
			.field("password", "correct-password")

		expect(res.status).toBe(500)
		expect(res.body).toMatchObject({
			success: false,
			message: "login.messages.internal-server-error",
			status_code: 500
		})
	})
})
