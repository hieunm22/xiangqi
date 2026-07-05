import express from "express"
import jwt from "jsonwebtoken"
import request from "supertest"
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

const identityFindUniqueMock = vi.fn()
const announcementReadFindFirstMock = vi.fn()
const announcementReadCreateMock = vi.fn()
const redisSetMock = vi.fn()
const fetchMock = vi.fn()
const APP_ID = "test-fb-app-id"
const PATH = "/api/auth/facebook"

vi.mock("prisma", () => ({
	default: {
		userIdentity: {
			findUnique: identityFindUniqueMock
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

const okJson = (body: unknown) => ({ ok: true, json: async () => body })

// Valid token: debug_token confirms our app owns it, /me returns a profile.
const setValidFacebookToken = (profile = { id: "fb-123", name: "Bob", email: "bob@example.com" }) => {
	fetchMock.mockImplementation(async (url: string) => {
		if (url.includes("/debug_token")) {
			return okJson({ data: { is_valid: true, app_id: APP_ID } })
		}
		if (url.includes("/me")) {
			return okJson(profile)
		}
		return { ok: false, json: async () => ({}) }
	})
}

describe("POST /api/auth/facebook", () => {
	let app: express.Express
	let consoleErrorSpy: ReturnType<typeof vi.spyOn>

	beforeAll(async () => {
		process.env.JWT_SECRET = "unit-test-secret"
		process.env.JWT_ISSUER = "unit-test-issuer"
		process.env.FACEBOOK_APP_ID = APP_ID
		process.env.FACEBOOK_APP_SECRET = "test-fb-secret"
		process.env.NODE_ENV = "test"

		vi.stubGlobal("fetch", fetchMock)

		const { default: facebookRoutes } = await import("./facebook")
		app = express()
		app.use(express.json())
		app.use("/api", facebookRoutes)
	})

	beforeEach(() => {
		announcementReadFindFirstMock.mockResolvedValue(null)
		announcementReadCreateMock.mockResolvedValue({ id: 1n })
	})

	afterEach(() => {
		vi.clearAllMocks()
		consoleErrorSpy?.mockRestore()
	})

	it("returns 400 when access token is missing", async () => {
		const res = await request(app).post(PATH).send({})

		expect(res.status).toBe(400)
		expect(res.body).toMatchObject({
			message: "facebook-login.messages.missing-token",
			status_code: 400
		})
		expect(fetchMock).not.toHaveBeenCalled()
	})

	it("returns 401 when the token does not belong to this app", async () => {
		fetchMock.mockImplementation(async (url: string) => {
			if (url.includes("/debug_token")) {
				return okJson({ data: { is_valid: true, app_id: "someone-elses-app" } })
			}
			return okJson({ id: "fb-123" })
		})

		const res = await request(app).post(PATH).send({ accessToken: "foreign-token" })

		expect(res.status).toBe(401)
		expect(res.body).toMatchObject({
			message: "facebook-login.messages.invalid-token",
			status_code: 401
		})
		expect(identityFindUniqueMock).not.toHaveBeenCalled()
	})

	it("returns 401 when the Graph API call throws", async () => {
		consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined)
		fetchMock.mockRejectedValue(new Error("network down"))

		const res = await request(app).post(PATH).send({ accessToken: "token" })

		expect(res.status).toBe(401)
		expect(res.body).toMatchObject({
			message: "facebook-login.messages.invalid-token",
			status_code: 401
		})
	})

	it("returns 400 when the Facebook account is not linked to any user", async () => {
		setValidFacebookToken()
		identityFindUniqueMock.mockResolvedValue(null)

		const res = await request(app).post(PATH).send({ accessToken: "token" })

		expect(res.status).toBe(400)
		expect(res.body).toMatchObject({
			message: "facebook-login.messages.not-linked",
			status_code: 400
		})
		expect(redisSetMock).not.toHaveBeenCalled()
	})

	it("logs in when the Facebook identity is linked", async () => {
		setValidFacebookToken()
		identityFindUniqueMock.mockResolvedValue({ user_id: 5n })

		const res = await request(app)
			.post(PATH)
			.send({ accessToken: "token", timezoneOffset: -420, deviceName: "Chrome" })

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
		expect(redisSetMock).toHaveBeenCalledTimes(2)
	})

	it("returns 500 when an unexpected error happens", async () => {
		consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined)
		setValidFacebookToken()
		identityFindUniqueMock.mockRejectedValue(new Error("db down"))

		const res = await request(app).post(PATH).send({ accessToken: "token" })

		expect(res.status).toBe(500)
		expect(res.body).toMatchObject({
			message: "facebook-login.messages.internal-server-error",
			status_code: 500
		})
	})
})
