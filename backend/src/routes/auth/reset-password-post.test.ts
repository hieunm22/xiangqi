import crypto from "crypto"
import express from "express"
import request from "supertest"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"

const prismaFindUniqueMock = vi.fn()
const prismaUpdateMock = vi.fn()
const redisDelMock = vi.fn()

const PATH = "/api/auth/reset-password"

vi.mock("prisma", () => ({
	default: {
		user: {
			findUnique: prismaFindUniqueMock,
			update: prismaUpdateMock
		}
	}
}))

vi.mock("../../common/redis", () => ({
	default: {
		del: redisDelMock,
		get: vi.fn()
	}
}))

describe("POST /api/auth/reset-password", () => {
	let app: express.Express
	let consoleErrorSpy: ReturnType<typeof vi.spyOn>

	beforeAll(async () => {
		process.env.JWT_SECRET = "unit-test-secret"

		const { default: resetPasswordRoutes } = await import("./reset-password")
		app = express()
		app.use(express.json())
		app.use("/api", resetPasswordRoutes)
	})

	afterEach(() => {
		vi.clearAllMocks()
		consoleErrorSpy?.mockRestore()
	})

	it("returns 400 when userId or password is missing", async () => {
		const res = await request(app).post(PATH).send({ userId: "", password: "" })

		expect(res.status).toBe(400)
		expect(res.body).toMatchObject({
			success: false,
			message: "reset-password.messages.missing-userId-or-password",
			status_code: 400
		})
		expect(prismaFindUniqueMock).not.toHaveBeenCalled()
		expect(prismaUpdateMock).not.toHaveBeenCalled()
	})

	it("returns 400 when user id is invalid", async () => {
		const res = await request(app).post(PATH).send({ userId: "abc", password: "new-pass" })

		expect(res.status).toBe(400)
		expect(res.body).toMatchObject({
			success: false,
			message: "reset-password.messages.invalid-user-id",
			status_code: 400
		})
		expect(prismaFindUniqueMock).not.toHaveBeenCalled()
	})

	it("returns 404 when user is not found", async () => {
		prismaFindUniqueMock.mockResolvedValue(null)

		const res = await request(app).post(PATH).send({ userId: 5, password: "new-pass" })

		expect(res.status).toBe(404)
		expect(res.body).toMatchObject({
			success: false,
			message: "reset-password.messages.user-not-found",
			status_code: 404
		})
		expect(prismaUpdateMock).not.toHaveBeenCalled()
		expect(redisDelMock).not.toHaveBeenCalled()
	})

	it("returns 200 and updates password when request is valid", async () => {
		prismaFindUniqueMock.mockResolvedValue({ id: BigInt(5) })
		prismaUpdateMock.mockResolvedValue({ id: BigInt(5) })
		redisDelMock.mockResolvedValue(1)

		const res = await request(app).post(PATH).send({ userId: " 5 ", password: "  new-pass  " })

		expect(res.status).toBe(200)
		expect(res.body).toMatchObject({
			success: true,
			message: "reset-password.messages.success",
			status_code: 200
		})

		const expectedHash = crypto
			.createHash("md5")
			.update("new-pass" + process.env.JWT_SECRET)
			.digest("hex")
			.toUpperCase()

		expect(prismaFindUniqueMock).toHaveBeenCalledWith({
			where: { id: BigInt(5) },
			select: { id: true }
		})
		expect(prismaUpdateMock).toHaveBeenCalledWith({
			where: { id: BigInt(5) },
			data: { password: expectedHash }
		})
		expect(redisDelMock).toHaveBeenCalledWith("forgot-password:5")
	})

	it("returns 500 when unexpected error happens", async () => {
		consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined)
		prismaFindUniqueMock.mockRejectedValue(new Error("db down"))

		const res = await request(app).post(PATH).send({ userId: 5, password: "new-pass" })

		expect(res.status).toBe(500)
		expect(res.body).toMatchObject({
			success: false,
			message: "reset-password.messages.internal-server-error",
			status_code: 500
		})
	})
})