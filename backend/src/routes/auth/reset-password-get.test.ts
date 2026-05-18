import express from "express"
import request from "supertest"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"

const prismaFindUniqueMock = vi.fn()
const redisGetMock = vi.fn()

const PATH = "/api/auth/reset-password"

vi.mock("prisma", () => ({
	default: {
		user: {
			findUnique: prismaFindUniqueMock,
			update: vi.fn()
		}
	}
}))

vi.mock("../../common/redis", () => ({
	default: {
		get: redisGetMock,
		del: vi.fn()
	}
}))

describe("GET /api/auth/reset-password", () => {
	let app: express.Express
	let consoleErrorSpy: ReturnType<typeof vi.spyOn>

	beforeAll(async () => {
		const { default: resetPasswordRoutes } = await import("./reset-password")
		app = express()
		app.use(express.json())
		app.use("/api", resetPasswordRoutes)
	})

	afterEach(() => {
		vi.clearAllMocks()
		consoleErrorSpy?.mockRestore()
	})

	it("returns 400 when id or token is missing", async () => {
		const res = await request(app).get(PATH)

		expect(res.status).toBe(400)
		expect(res.body).toMatchObject({
			success: false,
			message: "reset-password.messages.missing-id-or-token",
			status_code: 400,
			data: null
		})
	})

	it("returns 400 when user id is invalid", async () => {
		const res = await request(app).get(PATH).query({ id: "abc", token: "token-1" })

		expect(res.status).toBe(400)
		expect(res.body).toMatchObject({
			success: false,
			message: "reset-password.messages.invalid-user-id",
			status_code: 400,
			data: null
		})
		expect(redisGetMock).not.toHaveBeenCalled()
	})

	it("returns 401 when reset token is missing in cache", async () => {
		redisGetMock.mockResolvedValue(null)

		const res = await request(app).get(PATH).query({ id: "5", token: "token-1" })

		expect(res.status).toBe(401)
		expect(res.body).toMatchObject({
			success: false,
			message: "reset-password.messages.invalid-or-expired-token",
			status_code: 401,
			data: null
		})
		expect(prismaFindUniqueMock).not.toHaveBeenCalled()
	})

	it("returns 401 when reset token mismatches", async () => {
		redisGetMock.mockResolvedValue("different-token")

		const res = await request(app).get(PATH).query({ id: "5", token: "token-1" })

		expect(res.status).toBe(401)
		expect(res.body).toMatchObject({
			success: false,
			message: "reset-password.messages.invalid-or-expired-token",
			status_code: 401,
			data: null
		})
		expect(prismaFindUniqueMock).not.toHaveBeenCalled()
	})

	it("returns 404 when user is not found", async () => {
		redisGetMock.mockResolvedValue("token-1")
		prismaFindUniqueMock.mockResolvedValue(null)

		const res = await request(app).get(PATH).query({ id: "5", token: "token-1" })

		expect(res.status).toBe(404)
		expect(res.body).toMatchObject({
			success: false,
			message: "reset-password.messages.user-not-found",
			status_code: 404,
			data: null
		})
	})

	it("returns 200 when reset url is valid", async () => {
		redisGetMock.mockResolvedValue("token-1")
		prismaFindUniqueMock.mockResolvedValue({
			id: BigInt(5),
			user_name: "alice",
			email: "alice@example.com",
			display_name: "Alice",
			gender: true
		})

		const res = await request(app).get(PATH).query({ id: "5", token: "token-1" })

		expect(res.status).toBe(200)
		expect(res.body).toMatchObject({
			success: true,
			message: "reset-password.messages.token-valid",
			status_code: 200,
			data: {
				id: 5,
				user_name: "alice",
				email: "alice@example.com",
				display_name: "Alice",
				gender: true
			}
		})
	})

	it("returns 500 when unexpected error happens", async () => {
		consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined)
		redisGetMock.mockRejectedValue(new Error("redis down"))

		const res = await request(app).get(PATH).query({ id: "5", token: "token-1" })

		expect(res.status).toBe(500)
		expect(res.body).toMatchObject({
			success: false,
			message: "reset-password.messages.internal-server-error",
			status_code: 500,
			data: null
		})
	})
})
