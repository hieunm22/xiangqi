import express from "express"
import jwt from "jsonwebtoken"
import request from "supertest"
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

const verifyIdTokenMock = vi.fn()
const identityFindUniqueMock = vi.fn()
const identityCreateMock = vi.fn()
const userFindUniqueMock = vi.fn()
const announcementReadFindFirstMock = vi.fn()
const announcementReadCreateMock = vi.fn()
const redisSetMock = vi.fn()
const PATH = "/api/auth/google"

vi.mock("google-auth-library", () => ({
	OAuth2Client: class {
		verifyIdToken = verifyIdTokenMock
	}
}))

vi.mock("prisma", () => ({
	default: {
		userIdentity: {
			findUnique: identityFindUniqueMock,
			create: identityCreateMock
		},
		user: {
			findUnique: userFindUniqueMock
		},
		userAnnouncementRead: {
			findFirst: announcementReadFindFirstMock,
			create: announcementReadCreateMock
		}
	}
}))

vi.mock("../../common/redis", () => ({
	default: {
		set: redisSetMock
	}
}))

const ticket = (payload: Record<string, unknown> | undefined) => ({
	getPayload: () => payload
})

const verifiedPayload = (overrides: Record<string, unknown> = {}) => ({
	sub: "google-sub-123",
	email: "alice@example.com",
	email_verified: true,
	name: "Alice",
	...overrides
})

describe("POST /api/auth/google", () => {
	let app: express.Express
	let consoleErrorSpy: ReturnType<typeof vi.spyOn>

	beforeAll(async () => {
		process.env.JWT_SECRET = "unit-test-secret"
		process.env.JWT_ISSUER = "unit-test-issuer"
		process.env.GOOGLE_CLIENT_ID = "unit-test-google-client-id"
		process.env.NODE_ENV = "test"

		const { default: googleRoutes } = await import("./google")
		app = express()
		app.use(express.json())
		app.use("/api", googleRoutes)
	})

	beforeEach(() => {
		announcementReadFindFirstMock.mockResolvedValue(null)
		announcementReadCreateMock.mockResolvedValue({ id: 1n })
	})

	afterEach(() => {
		vi.clearAllMocks()
		consoleErrorSpy?.mockRestore()
	})

	it("returns 400 when credential is missing", async () => {
		const res = await request(app).post(PATH).send({})

		expect(res.status).toBe(400)
		expect(res.body).toMatchObject({
			success: false,
			message: "google-login.messages.missing-credential",
			status_code: 400
		})
		expect(verifyIdTokenMock).not.toHaveBeenCalled()
	})

	it("returns 401 when the Google token cannot be verified", async () => {
		consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined)
		verifyIdTokenMock.mockRejectedValue(new Error("invalid token"))

		const res = await request(app).post(PATH).send({ credential: "bad-token" })

		expect(res.status).toBe(401)
		expect(res.body).toMatchObject({
			success: false,
			message: "google-login.messages.invalid-token",
			status_code: 401
		})
		expect(identityFindUniqueMock).not.toHaveBeenCalled()
	})

	it("returns 400 when the token payload lacks sub or email", async () => {
		verifyIdTokenMock.mockResolvedValue(ticket({ sub: "x" }))

		const res = await request(app).post(PATH).send({ credential: "token" })

		expect(res.status).toBe(400)
		expect(res.body).toMatchObject({
			message: "google-login.messages.invalid-token",
			status_code: 400
		})
	})

	it("returns 400 when the email is not verified", async () => {
		verifyIdTokenMock.mockResolvedValue(ticket(verifiedPayload({ email_verified: false })))

		const res = await request(app).post(PATH).send({ credential: "token" })

		expect(res.status).toBe(400)
		expect(res.body).toMatchObject({
			message: "google-login.messages.email-not-verified",
			status_code: 400
		})
		expect(identityFindUniqueMock).not.toHaveBeenCalled()
	})

	it("returns 400 when no account matches the verified email", async () => {
		verifyIdTokenMock.mockResolvedValue(ticket(verifiedPayload()))
		identityFindUniqueMock.mockResolvedValue(null)
		userFindUniqueMock.mockResolvedValue(null)

		const res = await request(app).post(PATH).send({ credential: "token" })

		expect(res.status).toBe(400)
		expect(res.body).toMatchObject({
			message: "google-login.messages.failed",
			status_code: 400
		})
		expect(identityCreateMock).not.toHaveBeenCalled()
		expect(redisSetMock).not.toHaveBeenCalled()
	})

	it("logs in via an already linked Google identity", async () => {
		verifyIdTokenMock.mockResolvedValue(ticket(verifiedPayload()))
		identityFindUniqueMock.mockResolvedValue({ user_id: 5n })

		const res = await request(app)
			.post(PATH)
			.send({ credential: "token", timezoneOffset: -420, deviceName: "Chrome" })

		expect(res.status).toBe(200)
		expect(res.body).toMatchObject({
			success: true,
			message: "login.messages.success",
			status_code: 200,
			token_type: "Bearer"
		})

		const payload = jwt.verify(res.body.access_token, process.env.JWT_SECRET as string, {
			issuer: process.env.JWT_ISSUER
		}) as jwt.JwtPayload
		expect(Number(payload.sub)).toBe(5)
		expect(payload.timezoneOffset).toBe(-420)

		// Existing identity is reused, never re-created.
		expect(identityCreateMock).not.toHaveBeenCalled()
		expect(userFindUniqueMock).not.toHaveBeenCalled()
		expect(redisSetMock).toHaveBeenCalledTimes(2)
	})

	it("binds the Google identity to an existing account on first login", async () => {
		verifyIdTokenMock.mockResolvedValue(ticket(verifiedPayload({ email: "Alice@Example.com" })))
		identityFindUniqueMock.mockResolvedValue(null)
		userFindUniqueMock.mockResolvedValue({ id: 9n })
		identityCreateMock.mockResolvedValue({ id: 1n })

		const res = await request(app).post(PATH).send({ credential: "token" })

		expect(res.status).toBe(200)
		expect(res.body.success).toBe(true)

		// Account resolved by normalized (lowercased) verified email.
		expect(userFindUniqueMock).toHaveBeenCalledWith({
			where: { email: "alice@example.com" },
			select: { id: true }
		})
		expect(identityCreateMock).toHaveBeenCalledWith({
			data: {
				user_id: 9n,
				provider: "google",
				provider_user_id: "google-sub-123",
				email: "alice@example.com"
			}
		})

		const payload = jwt.verify(res.body.access_token, process.env.JWT_SECRET as string, {
			issuer: process.env.JWT_ISSUER
		}) as jwt.JwtPayload
		expect(Number(payload.sub)).toBe(9)
	})

	it("returns 500 when an unexpected error happens", async () => {
		consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined)
		verifyIdTokenMock.mockResolvedValue(ticket(verifiedPayload()))
		identityFindUniqueMock.mockRejectedValue(new Error("db down"))

		const res = await request(app).post(PATH).send({ credential: "token" })

		expect(res.status).toBe(500)
		expect(res.body).toMatchObject({
			message: "google-login.messages.internal-server-error",
			status_code: 500
		})
	})
})
