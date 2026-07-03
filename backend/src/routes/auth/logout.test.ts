import express from "express"
import jwt from "jsonwebtoken"
import request from "supertest"
import cookieParser from "cookie-parser"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"

const redisGetMock = vi.fn()
const redisExistsMock = vi.fn()
const redisDelMock = vi.fn()
const markOfflineMock = vi.fn()
const emitPresenceChangedMock = vi.fn()
const getConnectedDeviceCountMock = vi.fn()
const PATH = "/api/auth/logout"

vi.mock("../../common/redis", () => ({
	default: {
		get: redisGetMock,
		exists: redisExistsMock,
		del: redisDelMock
	}
}))

vi.mock("../../common/presence", () => ({
	markOffline: markOfflineMock
}))

vi.mock("../../common/socket", () => ({
	emitPresenceChanged: emitPresenceChangedMock,
	getConnectedDeviceCount: getConnectedDeviceCountMock
}))

describe("DELETE /api/auth/logout", () => {
	let app: express.Express
	let consoleErrorSpy: ReturnType<typeof vi.spyOn>

	beforeAll(async () => {
		process.env.JWT_SECRET = "unit-test-secret"
		process.env.JWT_ISSUER = "unit-test-issuer"
		process.env.NODE_ENV = "test"

		const { default: logoutRoutes } = await import("./logout")
		app = express()
		app.use(express.json())
		app.use(cookieParser())
		app.use("/api", logoutRoutes)
	})

	afterEach(() => {
		vi.clearAllMocks()
		consoleErrorSpy?.mockRestore()
	})

	it("returns 401 when authorization token is missing", async () => {
		const res = await request(app).delete(PATH)

		expect(res.status).toBe(401)
		expect(res.body).toMatchObject({
			success: false,
			message: "auth-middleware.messages.token-required",
			status_code: 401
		})
	})

	it("returns 401 when session is not found in cache", async () => {
		const accessToken = jwt.sign(
			{ sub: 1, jti: "session-logout-1" },
			process.env.JWT_SECRET as string,
			{ issuer: process.env.JWT_ISSUER, expiresIn: "1h" }
		)
		redisGetMock.mockResolvedValue(null)

		const res = await request(app)
			.delete(PATH)
			.set("Authorization", `Bearer ${accessToken}`)

		expect(res.status).toBe(401)
		expect(res.body).toMatchObject({
			success: false,
			message: "auth-middleware.messages.session-not-found",
			status_code: 401
		})
	})

	it("returns 200 and clears session keys when session is active", async () => {
		const accessToken = jwt.sign(
			{ sub: 2, jti: "session-logout-2" },
			process.env.JWT_SECRET as string,
			{ issuer: process.env.JWT_ISSUER, expiresIn: "1h" }
		)
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 2 }))
		redisExistsMock.mockResolvedValue(1)
		markOfflineMock.mockResolvedValue(true)
		getConnectedDeviceCountMock.mockReturnValue(1)

		const res = await request(app)
			.delete(PATH)
			.set("Authorization", `Bearer ${accessToken}`)

		expect(res.status).toBe(200)
		expect(res.body).toMatchObject({
			success: true,
			message: "logout.messages.success",
			status_code: 200
		})
		expect(markOfflineMock).toHaveBeenCalledWith(2)
		expect(emitPresenceChangedMock).toHaveBeenCalledWith(2, "offline")
		expect(redisExistsMock).toHaveBeenCalledWith("login-session:2:session-logout-2")
		expect(redisDelMock).toHaveBeenCalledTimes(2)
		expect(redisDelMock).toHaveBeenNthCalledWith(1, "login-session:2:session-logout-2")
		expect(redisDelMock).toHaveBeenNthCalledWith(2, "refresh-token:2:session-logout-2")

		const serializedCookies = Array.isArray(res.headers["set-cookie"])
			? res.headers["set-cookie"].join(";")
			: String(res.headers["set-cookie"] ?? "")
		expect(serializedCookies).toContain("refresh-token=")
	})

	it("does not drop presence when another device is still connected", async () => {
		const accessToken = jwt.sign(
			{ sub: 2, jti: "session-logout-2b" },
			process.env.JWT_SECRET as string,
			{ issuer: process.env.JWT_ISSUER, expiresIn: "1h" }
		)
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 2 }))
		redisExistsMock.mockResolvedValue(1)
		// Two devices online for this account.
		getConnectedDeviceCountMock.mockReturnValue(2)

		const res = await request(app)
			.delete(PATH)
			.set("Authorization", `Bearer ${accessToken}`)

		expect(res.status).toBe(200)
		// The other device's heartbeat keeps the user online — no offline broadcast.
		expect(markOfflineMock).not.toHaveBeenCalled()
		expect(emitPresenceChangedMock).not.toHaveBeenCalled()
	})

	it("returns 200 with inactive message when session does not exist", async () => {
		const accessToken = jwt.sign(
			{ sub: 3, jti: "session-logout-3" },
			process.env.JWT_SECRET as string,
			{ issuer: process.env.JWT_ISSUER, expiresIn: "1h" }
		)
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 3 }))
		redisExistsMock.mockResolvedValue(0)

		const res = await request(app)
			.delete(PATH)
			.set("Authorization", `Bearer ${accessToken}`)

		expect(res.status).toBe(200)
		expect(res.body).toMatchObject({
			success: true,
			message: "logout.messages.already-inactive",
			status_code: 200
		})
		expect(redisDelMock).not.toHaveBeenCalled()
	})

	it("returns 500 when unexpected error happens", async () => {
		const accessToken = jwt.sign(
			{ sub: 4, jti: "session-logout-4" },
			process.env.JWT_SECRET as string,
			{ issuer: process.env.JWT_ISSUER, expiresIn: "1h" }
		)
		consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined)
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 4 }))
		redisExistsMock.mockRejectedValue(new Error("redis down"))

		const res = await request(app)
			.delete(PATH)
			.set("Authorization", `Bearer ${accessToken}`)

		expect(res.status).toBe(500)
		expect(res.body).toMatchObject({
			success: false,
			message: "logout.messages.internal-server-error",
			status_code: 500
		})
	})
})