import crypto from "crypto"
import express from "express"
import jwt from "jsonwebtoken"
import request from "supertest"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"

const userFindUniqueMock = vi.fn()
const userUpdateMock = vi.fn()
const redisGetMock = vi.fn()
const PATH = "/api/auth/change-password"

vi.mock("prisma", () => ({
	default: {
		user: {
			findUnique: userFindUniqueMock,
			update: userUpdateMock
		}
	}
}))

vi.mock("../../common/redis", () => ({
	default: {
		get: redisGetMock
	}
}))

const hashPassword = (password: string): string =>
	crypto
		.createHash("md5")
		.update(password + process.env.JWT_SECRET)
		.digest("hex")
		.toUpperCase()

const authFor = (userId: number, sessionId: string) => {
	redisGetMock.mockResolvedValue(JSON.stringify({ userId }))
	return jwt.sign(
		{ sub: userId, jti: sessionId },
		process.env.JWT_SECRET as string,
		{ issuer: process.env.JWT_ISSUER, expiresIn: "1h" }
	)
}

const STRONG_PASSWORD = "Abcdef1!"
const ANOTHER_STRONG_PASSWORD = "Xyzuvw2@"

describe("POST /api/auth/change-password", () => {
	let app: express.Express
	let consoleErrorSpy: ReturnType<typeof vi.spyOn>

	beforeAll(async () => {
		process.env.JWT_SECRET = "unit-test-secret"
		process.env.JWT_ISSUER = "unit-test-issuer"
		process.env.NODE_ENV = "test"

		const { default: changePasswordRoutes } = await import("./change-password")
		app = express()
		app.use(express.json())
		app.use("/api", changePasswordRoutes)
	})

	afterEach(() => {
		vi.clearAllMocks()
		consoleErrorSpy?.mockRestore()
	})

	it("returns 401 when not authenticated", async () => {
		const res = await request(app)
			.post(PATH)
			.send({ currentPassword: STRONG_PASSWORD, newPassword: ANOTHER_STRONG_PASSWORD })

		expect(res.status).toBe(401)
		expect(userFindUniqueMock).not.toHaveBeenCalled()
	})

	it("returns 400 when fields are missing", async () => {
		const token = authFor(7, "s-missing")

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${token}`)
			.send({ currentPassword: STRONG_PASSWORD })

		expect(res.status).toBe(400)
		expect(res.body).toMatchObject({
			message: "change-password.messages.missing-fields",
			status_code: 400
		})
		expect(userFindUniqueMock).not.toHaveBeenCalled()
	})

	it("returns 400 when the new password does not meet the policy", async () => {
		const token = authFor(7, "s-weak")

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${token}`)
			.send({ currentPassword: STRONG_PASSWORD, newPassword: "weak" })

		expect(res.status).toBe(400)
		expect(res.body).toMatchObject({
			message: "change-password.messages.weak-password",
			status_code: 400
		})
		expect(userFindUniqueMock).not.toHaveBeenCalled()
	})

	it("returns 404 when the user does not exist", async () => {
		const token = authFor(7, "s-notfound")
		userFindUniqueMock.mockResolvedValue(null)

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${token}`)
			.send({ currentPassword: STRONG_PASSWORD, newPassword: ANOTHER_STRONG_PASSWORD })

		expect(res.status).toBe(404)
		expect(res.body).toMatchObject({
			message: "change-password.messages.user-not-found",
			status_code: 404
		})
		expect(userUpdateMock).not.toHaveBeenCalled()
	})

	it("returns 401 when the current password is incorrect", async () => {
		const token = authFor(7, "s-wrong")
		userFindUniqueMock.mockResolvedValue({ id: BigInt(7), password: hashPassword(STRONG_PASSWORD) })

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${token}`)
			.send({ currentPassword: "Wrongpw1!", newPassword: ANOTHER_STRONG_PASSWORD })

		expect(res.status).toBe(401)
		expect(res.body).toMatchObject({
			message: "change-password.messages.incorrect-current-password",
			status_code: 401
		})
		expect(userUpdateMock).not.toHaveBeenCalled()
	})

	it("returns 400 when the new password equals the current one", async () => {
		const token = authFor(7, "s-same")
		userFindUniqueMock.mockResolvedValue({ id: BigInt(7), password: hashPassword(STRONG_PASSWORD) })

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${token}`)
			.send({ currentPassword: STRONG_PASSWORD, newPassword: STRONG_PASSWORD })

		expect(res.status).toBe(400)
		expect(res.body).toMatchObject({
			message: "change-password.messages.same-as-current",
			status_code: 400
		})
		expect(userUpdateMock).not.toHaveBeenCalled()
	})

	it("changes the password and returns 200 on success", async () => {
		const token = authFor(7, "s-ok")
		userFindUniqueMock.mockResolvedValue({ id: BigInt(7), password: hashPassword(STRONG_PASSWORD) })
		userUpdateMock.mockResolvedValue({ id: BigInt(7) })

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${token}`)
			.send({ currentPassword: STRONG_PASSWORD, newPassword: ANOTHER_STRONG_PASSWORD })

		expect(res.status).toBe(200)
		expect(res.body).toMatchObject({
			success: true,
			message: "change-password.messages.success",
			status_code: 200
		})
		expect(userUpdateMock).toHaveBeenCalledWith({
			where: { id: BigInt(7) },
			data: { password: hashPassword(ANOTHER_STRONG_PASSWORD) }
		})
	})

	it("returns 500 when the update fails", async () => {
		const token = authFor(7, "s-500")
		consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined)
		userFindUniqueMock.mockResolvedValue({ id: BigInt(7), password: hashPassword(STRONG_PASSWORD) })
		userUpdateMock.mockRejectedValue(new Error("db down"))

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${token}`)
			.send({ currentPassword: STRONG_PASSWORD, newPassword: ANOTHER_STRONG_PASSWORD })

		expect(res.status).toBe(500)
		expect(res.body).toMatchObject({
			message: "change-password.messages.internal-server-error",
			status_code: 500
		})
	})
})
