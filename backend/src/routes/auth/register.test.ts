import crypto from "crypto"
import express from "express"
import request from "supertest"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"

const prismaFindUniqueMock = vi.fn()
const prismaCreateMock = vi.fn()
const PATH = "/api/auth/register"

vi.mock("prisma", () => ({
	default: {
		user: {
			findUnique: prismaFindUniqueMock,
			create: prismaCreateMock
		}
	}
}))

describe("POST /api/auth/register", () => {
	let app: express.Express
	let consoleErrorSpy: ReturnType<typeof vi.spyOn>

	beforeAll(async () => {
		process.env.JWT_SECRET = "unit-test-secret"
		process.env.NODE_ENV = "test"

		const { default: registerRoutes } = await import("./register")
		app = express()
		app.use(express.json())
		app.use("/api", registerRoutes)
	})

	afterEach(() => {
		vi.clearAllMocks()
		consoleErrorSpy?.mockRestore()
	})

	it("returns 400 when required fields are missing", async () => {
		const res = await request(app).post(PATH).send({
			username: "",
			password: "",
			email: "",
			displayName: "",
			gender: ""
		})

		expect(res.status).toBe(400)
		expect(res.body).toMatchObject({
			success: false,
			message: "register.messages.missing-fields",
			status_code: 400
		})
		expect(prismaFindUniqueMock).not.toHaveBeenCalled()
		expect(prismaCreateMock).not.toHaveBeenCalled()
	})

	it("returns 409 when username already exists", async () => {
		prismaFindUniqueMock.mockResolvedValueOnce({ id: 1 })
		prismaFindUniqueMock.mockResolvedValueOnce(null)

		const res = await request(app).post(PATH).send({
			username: "alice",
			password: "secret",
			email: "alice@example.com",
			displayName: "Alice",
			gender: true
		})

		expect(res.status).toBe(409)
		expect(res.body).toMatchObject({
			success: false,
			message: "register.messages.username-exists",
			status_code: 409
		})
		expect(prismaCreateMock).not.toHaveBeenCalled()
	})

	it("returns 409 when email already exists", async () => {
		prismaFindUniqueMock.mockResolvedValueOnce(null)
		prismaFindUniqueMock.mockResolvedValueOnce({ id: 2 })

		const res = await request(app).post(PATH).send({
			username: "alice",
			password: "secret",
			email: "alice@example.com",
			displayName: "Alice",
			gender: true
		})

		expect(res.status).toBe(409)
		expect(res.body).toMatchObject({
			success: false,
			message: "register.messages.email-exists",
			status_code: 409
		})
		expect(prismaCreateMock).not.toHaveBeenCalled()
	})

	it("returns 201 and creates user when request is valid", async () => {
		prismaFindUniqueMock.mockResolvedValueOnce(null)
		prismaFindUniqueMock.mockResolvedValueOnce(null)
		prismaCreateMock.mockResolvedValue({
			id: 10,
			user_name: "alice",
			email: "alice@example.com",
			display_name: "Alice",
			gender: true,
			avatar_seq: 1
		})

		const res = await request(app).post(PATH).send({
			username: "alice",
			password: "secret",
			email: "ALICE@EXAMPLE.COM",
			displayName: "Alice",
			gender: "male"
		})

		expect(res.status).toBe(201)
		expect(res.body).toMatchObject({
			success: true,
			message: "register.messages.success",
			status_code: 201,
			data: {
				id: 10,
				user_name: "alice",
				email: "alice@example.com",
				display_name: "Alice",
				gender: true,
				avatar_seq: 1
			}
		})

		const expectedHash = crypto
			.createHash("md5")
			.update("secret" + process.env.JWT_SECRET)
			.digest("hex")
			.toUpperCase()

		expect(prismaCreateMock).toHaveBeenCalledWith(
			expect.objectContaining({
				data: {
					user_name: "alice",
					password: expectedHash,
					gender: true,
					display_name: "Alice",
					email: "alice@example.com"
				}
			})
		)
	})

	it("returns 409 when prisma create throws P2002 for user_name", async () => {
		prismaFindUniqueMock.mockResolvedValueOnce(null)
		prismaFindUniqueMock.mockResolvedValueOnce(null)
		prismaCreateMock.mockRejectedValue({
			code: "P2002",
			meta: { target: ["user_name"] }
		})

		const res = await request(app).post(PATH).send({
			username: "alice",
			password: "secret",
			email: "alice@example.com",
			displayName: "Alice",
			gender: true
		})

		expect(res.status).toBe(409)
		expect(res.body).toMatchObject({
			success: false,
			message: "register.messages.username-exists",
			status_code: 409
		})
	})

	it("returns 409 when prisma create throws P2002 for email", async () => {
		prismaFindUniqueMock.mockResolvedValueOnce(null)
		prismaFindUniqueMock.mockResolvedValueOnce(null)
		prismaCreateMock.mockRejectedValue({
			code: "P2002",
			meta: { target: ["email"] }
		})

		const res = await request(app).post(PATH).send({
			username: "alice",
			password: "secret",
			email: "alice@example.com",
			displayName: "Alice",
			gender: true
		})

		expect(res.status).toBe(409)
		expect(res.body).toMatchObject({
			success: false,
			message: "register.messages.email-exists",
			status_code: 409
		})
	})

	it("returns 500 when unexpected error happens", async () => {
		consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined)
		prismaFindUniqueMock.mockRejectedValue(new Error("db down"))

		const res = await request(app).post(PATH).send({
			username: "alice",
			password: "secret",
			email: "alice@example.com",
			displayName: "Alice",
			gender: true
		})

		expect(res.status).toBe(500)
		expect(res.body).toMatchObject({
			success: false,
			message: "register.messages.internal-server-error",
			status_code: 500
		})
	})
})
