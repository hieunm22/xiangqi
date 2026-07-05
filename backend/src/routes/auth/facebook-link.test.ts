import express from "express"
import jwt from "jsonwebtoken"
import request from "supertest"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"

const identityFindUniqueMock = vi.fn()
const identityFindFirstMock = vi.fn()
const identityCreateMock = vi.fn()
const identityDeleteManyMock = vi.fn()
const redisGetMock = vi.fn()
const fetchMock = vi.fn()
const APP_ID = "test-fb-app-id"
const PATH = "/api/auth/facebook-link"

vi.mock("prisma", () => ({
	default: {
		userIdentity: {
			findUnique: identityFindUniqueMock,
			findFirst: identityFindFirstMock,
			create: identityCreateMock,
			deleteMany: identityDeleteManyMock
		}
	}
}))

vi.mock("../../common/redis", () => ({
	default: {
		get: redisGetMock
	}
}))

const okJson = (body: unknown) => ({ ok: true, json: async () => body })

const setValidFacebookToken = (profile = { id: "fb-999", name: "Bob", email: "bob@example.com" }) => {
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

// Build a valid access token for `userId` and prime the session lookup.
const authFor = (userId: number, sessionId: string) => {
	redisGetMock.mockResolvedValue(JSON.stringify({ userId }))
	return jwt.sign(
		{ sub: userId, jti: sessionId },
		process.env.JWT_SECRET as string,
		{ issuer: process.env.JWT_ISSUER, expiresIn: "1h" }
	)
}

describe("Facebook link routes", () => {
	let app: express.Express
	let consoleErrorSpy: ReturnType<typeof vi.spyOn>

	beforeAll(async () => {
		process.env.JWT_SECRET = "unit-test-secret"
		process.env.JWT_ISSUER = "unit-test-issuer"
		process.env.FACEBOOK_APP_ID = APP_ID
		process.env.FACEBOOK_APP_SECRET = "test-fb-secret"
		process.env.NODE_ENV = "test"

		vi.stubGlobal("fetch", fetchMock)

		const { default: facebookLinkRoutes } = await import("./facebook-link")
		app = express()
		app.use(express.json())
		app.use("/api", facebookLinkRoutes)
	})

	afterEach(() => {
		vi.clearAllMocks()
		consoleErrorSpy?.mockRestore()
	})

	describe("POST /api/auth/facebook-link", () => {
		it("returns 401 when not authenticated", async () => {
			const res = await request(app).post(PATH).send({ accessToken: "token" })

			expect(res.status).toBe(401)
			expect(fetchMock).not.toHaveBeenCalled()
		})

		it("returns 400 when access token is missing", async () => {
			const token = authFor(7, "s-1")

			const res = await request(app)
				.post(PATH)
				.set("Authorization", `Bearer ${token}`)
				.send({})

			expect(res.status).toBe(400)
			expect(res.body).toMatchObject({
				message: "facebook-link.messages.missing-token",
				status_code: 400
			})
		})

		it("returns 401 when the Facebook token is invalid", async () => {
			const token = authFor(7, "s-2")
			fetchMock.mockImplementation(async () => okJson({ data: { is_valid: false } }))

			const res = await request(app)
				.post(PATH)
				.set("Authorization", `Bearer ${token}`)
				.send({ accessToken: "bad" })

			expect(res.status).toBe(401)
			expect(res.body).toMatchObject({
				message: "facebook-link.messages.invalid-token",
				status_code: 401
			})
		})

		it("links the Facebook account to the current user", async () => {
			const token = authFor(7, "s-3")
			setValidFacebookToken()
			identityFindUniqueMock.mockResolvedValue(null)
			identityFindFirstMock.mockResolvedValue(null)
			identityCreateMock.mockResolvedValue({ id: 1n })

			const res = await request(app)
				.post(PATH)
				.set("Authorization", `Bearer ${token}`)
				.send({ accessToken: "token" })

			expect(res.status).toBe(200)
			expect(res.body).toMatchObject({
				success: true,
				message: "facebook-link.messages.linked",
				status_code: 200
			})
			expect(identityCreateMock).toHaveBeenCalledWith({
				data: {
					user_id: 7,
					provider: "facebook",
					provider_user_id: "fb-999",
					email: "bob@example.com"
				}
			})
		})

		it("is idempotent when the account is already linked to the same user", async () => {
			const token = authFor(7, "s-4")
			setValidFacebookToken()
			identityFindUniqueMock.mockResolvedValue({ user_id: 7n })

			const res = await request(app)
				.post(PATH)
				.set("Authorization", `Bearer ${token}`)
				.send({ accessToken: "token" })

			expect(res.status).toBe(200)
			expect(res.body).toMatchObject({
				message: "facebook-link.messages.already-linked",
				status_code: 200
			})
			expect(identityCreateMock).not.toHaveBeenCalled()
		})

		it("returns 409 when the Facebook account belongs to another user", async () => {
			const token = authFor(7, "s-5")
			setValidFacebookToken()
			identityFindUniqueMock.mockResolvedValue({ user_id: 42n })

			const res = await request(app)
				.post(PATH)
				.set("Authorization", `Bearer ${token}`)
				.send({ accessToken: "token" })

			expect(res.status).toBe(409)
			expect(res.body).toMatchObject({
				message: "facebook-link.messages.linked-to-other",
				status_code: 409
			})
			expect(identityCreateMock).not.toHaveBeenCalled()
		})

		it("returns 409 when the user already linked a different Facebook account", async () => {
			const token = authFor(7, "s-6")
			setValidFacebookToken()
			identityFindUniqueMock.mockResolvedValue(null)
			identityFindFirstMock.mockResolvedValue({ id: 3n })

			const res = await request(app)
				.post(PATH)
				.set("Authorization", `Bearer ${token}`)
				.send({ accessToken: "token" })

			expect(res.status).toBe(409)
			expect(res.body).toMatchObject({
				message: "facebook-link.messages.already-has-facebook",
				status_code: 409
			})
			expect(identityCreateMock).not.toHaveBeenCalled()
		})

		it("returns 500 when an unexpected error happens", async () => {
			const token = authFor(7, "s-7")
			consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined)
			setValidFacebookToken()
			identityFindUniqueMock.mockRejectedValue(new Error("db down"))

			const res = await request(app)
				.post(PATH)
				.set("Authorization", `Bearer ${token}`)
				.send({ accessToken: "token" })

			expect(res.status).toBe(500)
			expect(res.body).toMatchObject({
				message: "facebook-link.messages.internal-server-error",
				status_code: 500
			})
		})
	})

	describe("DELETE /api/auth/facebook-link", () => {
		it("returns 401 when not authenticated", async () => {
			const res = await request(app).delete(PATH)

			expect(res.status).toBe(401)
		})

		it("unlinks the Facebook account for the current user", async () => {
			const token = authFor(7, "s-8")
			identityDeleteManyMock.mockResolvedValue({ count: 1 })

			const res = await request(app)
				.delete(PATH)
				.set("Authorization", `Bearer ${token}`)

			expect(res.status).toBe(200)
			expect(res.body).toMatchObject({
				success: true,
				message: "facebook-link.messages.unlinked",
				status_code: 200
			})
			expect(identityDeleteManyMock).toHaveBeenCalledWith({
				where: { user_id: 7, provider: "facebook" }
			})
		})

		it("returns 500 when unlink fails", async () => {
			const token = authFor(7, "s-9")
			consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined)
			identityDeleteManyMock.mockRejectedValue(new Error("db down"))

			const res = await request(app)
				.delete(PATH)
				.set("Authorization", `Bearer ${token}`)

			expect(res.status).toBe(500)
			expect(res.body).toMatchObject({
				message: "facebook-link.messages.internal-server-error",
				status_code: 500
			})
		})
	})
})
