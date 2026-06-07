import express from "express"
import request from "supertest"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"

const userFindUniqueMock = vi.fn()

const PATH = "/api/auth/user"

vi.mock("prisma", () => ({
	default: {
		user: {
			findUnique: userFindUniqueMock
		}
	}
}))

describe("GET /api/auth/user?id=:id", () => {
	let app: express.Express
	let consoleErrorSpy: ReturnType<typeof vi.spyOn>

	beforeAll(async () => {
		const { default: getUserRoutes } = await import("./get-user")
		app = express()
		app.use(express.json())
		app.use("/api", getUserRoutes)
	})

	afterEach(() => {
		vi.clearAllMocks()
		consoleErrorSpy?.mockRestore()
	})

	it("returns 400 when user id is missing", async () => {
		const res = await request(app).get(PATH)

		expect(res.status).toBe(400)
		expect(res.body).toMatchObject({
			success: false,
			message: "Invalid user ID",
			status_code: 400
		})
		expect(userFindUniqueMock).not.toHaveBeenCalled()
	})

	it("returns 400 when user id is invalid", async () => {
		const res = await request(app).get(`${PATH}?id=abc`)

		expect(res.status).toBe(400)
		expect(res.body).toMatchObject({
			success: false,
			message: "Invalid user ID",
			status_code: 400
		})
		expect(userFindUniqueMock).not.toHaveBeenCalled()
	})

	it("returns 404 when user is not found", async () => {
		userFindUniqueMock.mockResolvedValue(null)

		const res = await request(app).get(`${PATH}?id=101`)

		expect(res.status).toBe(404)
		expect(res.body).toMatchObject({
			success: false,
			message: "User not found",
			status_code: 404
		})
		expect(userFindUniqueMock).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { id: 101 },
				select: expect.objectContaining({
					id: true,
					user_name: true,
					email: true,
					display_name: true,
					gender: true,
					avatar_seq: true
				})
			})
		)
	})

	it("returns 200 and user data when user exists", async () => {
		userFindUniqueMock.mockResolvedValue({
			id: BigInt(101),
			user_name: "alice",
			email: "alice@example.com",
			display_name: "Alice",
			gender: true,
			avatar_seq: 2
		})

		const res = await request(app).get(`${PATH}?id=101`)

		expect(res.status).toBe(200)
		expect(res.body).toMatchObject({
			success: true,
			status_code: 200,
			data: {
				id: 101,
				user_name: "alice",
				email: "alice@example.com",
				display_name: "Alice",
				gender: true,
				avatar_url: "/images/101_2.jpg"
			}
		})
	})

	it("returns 500 when unexpected error happens", async () => {
		consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined)
		userFindUniqueMock.mockRejectedValue(new Error("db down"))

		const res = await request(app).get(`${PATH}?id=101`)

		expect(res.status).toBe(500)
		expect(res.body).toMatchObject({
			success: false,
			message: "Internal server error",
			status_code: 500
		})
	})
})
