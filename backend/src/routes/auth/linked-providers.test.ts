import express from "express"
import jwt from "jsonwebtoken"
import request from "supertest"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"

const identityFindManyMock = vi.fn()
const redisGetMock = vi.fn()
const PATH = "/api/auth/linked-providers"

vi.mock("prisma", () => ({
	default: {
		userIdentity: {
			findMany: identityFindManyMock
		}
	}
}))

vi.mock("../../common/redis", () => ({
	default: {
		get: redisGetMock
	}
}))

const authFor = (userId: number, sessionId: string) => {
	redisGetMock.mockResolvedValue(JSON.stringify({ userId }))
	return jwt.sign(
		{ sub: userId, jti: sessionId },
		process.env.JWT_SECRET as string,
		{ issuer: process.env.JWT_ISSUER, expiresIn: "1h" }
	)
}

describe("GET /api/auth/linked-providers", () => {
	let app: express.Express
	let consoleErrorSpy: ReturnType<typeof vi.spyOn>

	beforeAll(async () => {
		process.env.JWT_SECRET = "unit-test-secret"
		process.env.JWT_ISSUER = "unit-test-issuer"
		process.env.NODE_ENV = "test"

		const { default: linkedProvidersRoutes } = await import("./linked-providers")
		app = express()
		app.use(express.json())
		app.use("/api", linkedProvidersRoutes)
	})

	afterEach(() => {
		vi.clearAllMocks()
		consoleErrorSpy?.mockRestore()
	})

	it("returns 401 when not authenticated", async () => {
		const res = await request(app).get(PATH)

		expect(res.status).toBe(401)
		expect(identityFindManyMock).not.toHaveBeenCalled()
	})

	it("returns the list of linked providers for the current user", async () => {
		const token = authFor(7, "s-1")
		identityFindManyMock.mockResolvedValue([{ provider: "google" }, { provider: "facebook" }])

		const res = await request(app)
			.get(PATH)
			.set("Authorization", `Bearer ${token}`)

		expect(res.status).toBe(200)
		expect(res.body).toMatchObject({
			success: true,
			status_code: 200,
			data: { providers: ["google", "facebook"] }
		})
		expect(identityFindManyMock).toHaveBeenCalledWith({
			where: { user_id: 7 },
			select: { provider: true }
		})
	})

	it("returns an empty list when nothing is linked", async () => {
		const token = authFor(7, "s-2")
		identityFindManyMock.mockResolvedValue([])

		const res = await request(app)
			.get(PATH)
			.set("Authorization", `Bearer ${token}`)

		expect(res.status).toBe(200)
		expect(res.body.data.providers).toEqual([])
	})

	it("returns 500 when the query fails", async () => {
		const token = authFor(7, "s-3")
		consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined)
		identityFindManyMock.mockRejectedValue(new Error("db down"))

		const res = await request(app)
			.get(PATH)
			.set("Authorization", `Bearer ${token}`)

		expect(res.status).toBe(500)
		expect(res.body).toMatchObject({
			message: "facebook-link.messages.internal-server-error",
			status_code: 500
		})
	})
})
