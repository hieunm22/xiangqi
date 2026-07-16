import express from "express"
import jwt from "jsonwebtoken"
import request from "supertest"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"

const redisGetMock = vi.fn()
const userFindUniqueMock = vi.fn()
const userUpdateMock = vi.fn()
const PATH = "/api/user/selected-tab"

vi.mock("../../common/redis", () => ({
	default: {
		get: redisGetMock
	}
}))

vi.mock("prisma", () => ({
	default: {
		user: {
			findUnique: userFindUniqueMock,
			update: userUpdateMock
		}
	}
}))

describe("selected-tab routes", () => {
	let app: express.Express
	let consoleErrorSpy: ReturnType<typeof vi.spyOn>

	beforeAll(async () => {
		process.env.JWT_SECRET = "unit-test-secret"
		process.env.JWT_ISSUER = "unit-test-issuer"

		const { default: selectedTabRoutes } = await import("./selected-tab")
		app = express()
		app.use(express.json())
		app.use("/api", selectedTabRoutes)
	})

	afterEach(() => {
		vi.clearAllMocks()
		consoleErrorSpy?.mockRestore()
	})

	const buildAccessToken = (userId: number, sessionId: string) =>
		jwt.sign({ sub: userId, jti: sessionId }, process.env.JWT_SECRET as string, {
			issuer: process.env.JWT_ISSUER,
			expiresIn: "1h"
		})

	describe("GET /api/user/selected-tab", () => {
		it("returns 401 when authorization token is missing", async () => {
			const res = await request(app).get(PATH)

			expect(res.status).toBe(401)
			expect(res.body).toMatchObject({
				success: false,
				message: "auth-middleware.messages.token-required",
				status_code: 401
			})
			expect(userFindUniqueMock).not.toHaveBeenCalled()
		})

		it("returns 404 when the user does not exist", async () => {
			const accessToken = buildAccessToken(1, "session-tab-1")
			redisGetMock.mockResolvedValue(JSON.stringify({ userId: 1 }))
			userFindUniqueMock.mockResolvedValue(null)

			const res = await request(app)
				.get(PATH)
				.set("Authorization", `Bearer ${accessToken}`)

			expect(res.status).toBe(404)
			expect(res.body).toMatchObject({
				success: false,
				message: "User not found",
				status_code: 404
			})
		})

		it("returns the persisted tab when it is within range", async () => {
			const accessToken = buildAccessToken(2, "session-tab-2")
			redisGetMock.mockResolvedValue(JSON.stringify({ userId: 2 }))
			userFindUniqueMock.mockResolvedValue({ selected_tab: 2 })

			const res = await request(app)
				.get(PATH)
				.set("Authorization", `Bearer ${accessToken}`)

			expect(res.status).toBe(200)
			expect(res.body.data).toMatchObject({ selected_tab: 2 })
		})

		it("clamps an out-of-range stored value to 0 without writing back", async () => {
			const accessToken = buildAccessToken(3, "session-tab-3")
			redisGetMock.mockResolvedValue(JSON.stringify({ userId: 3 }))
			userFindUniqueMock.mockResolvedValue({ selected_tab: 5 })

			const res = await request(app)
				.get(PATH)
				.set("Authorization", `Bearer ${accessToken}`)

			expect(res.status).toBe(200)
			expect(res.body.data).toMatchObject({ selected_tab: 0 })
			// GET is side-effect free: the invalid value is not corrected here.
			expect(userUpdateMock).not.toHaveBeenCalled()
		})

		it("clamps a negative stored value to 0", async () => {
			const accessToken = buildAccessToken(4, "session-tab-4")
			redisGetMock.mockResolvedValue(JSON.stringify({ userId: 4 }))
			userFindUniqueMock.mockResolvedValue({ selected_tab: -1 })

			const res = await request(app)
				.get(PATH)
				.set("Authorization", `Bearer ${accessToken}`)

			expect(res.status).toBe(200)
			expect(res.body.data).toMatchObject({ selected_tab: 0 })
		})

		it("returns 500 when a database error occurs", async () => {
			const accessToken = buildAccessToken(5, "session-tab-5")
			redisGetMock.mockResolvedValue(JSON.stringify({ userId: 5 }))
			consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
			userFindUniqueMock.mockRejectedValue(new Error("Database connection error"))

			const res = await request(app)
				.get(PATH)
				.set("Authorization", `Bearer ${accessToken}`)

			expect(res.status).toBe(500)
			expect(res.body).toMatchObject({
				success: false,
				message: "Internal server error",
				status_code: 500
			})
			expect(consoleErrorSpy).toHaveBeenCalledWith("Get selected tab error:", expect.any(Error))
		})
	})

	describe("PATCH /api/user/selected-tab", () => {
		it("returns 401 when authorization token is missing", async () => {
			const res = await request(app).patch(PATH).send({ tab: 1 })

			expect(res.status).toBe(401)
			expect(res.body).toMatchObject({
				success: false,
				message: "auth-middleware.messages.token-required",
				status_code: 401
			})
			expect(userUpdateMock).not.toHaveBeenCalled()
		})

		it("returns 400 when tab is missing", async () => {
			const accessToken = buildAccessToken(6, "session-tab-6")
			redisGetMock.mockResolvedValue(JSON.stringify({ userId: 6 }))

			const res = await request(app)
				.patch(PATH)
				.set("Authorization", `Bearer ${accessToken}`)
				.send({})

			expect(res.status).toBe(400)
			expect(res.body).toMatchObject({ success: false, status_code: 400 })
			expect(userUpdateMock).not.toHaveBeenCalled()
		})

		it("returns 400 when tab is not an integer", async () => {
			const accessToken = buildAccessToken(7, "session-tab-7")
			redisGetMock.mockResolvedValue(JSON.stringify({ userId: 7 }))

			const res = await request(app)
				.patch(PATH)
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ tab: 1.5 })

			expect(res.status).toBe(400)
			expect(userUpdateMock).not.toHaveBeenCalled()
		})

		it("returns 400 when tab is below the valid range", async () => {
			const accessToken = buildAccessToken(8, "session-tab-8")
			redisGetMock.mockResolvedValue(JSON.stringify({ userId: 8 }))

			const res = await request(app)
				.patch(PATH)
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ tab: -1 })

			expect(res.status).toBe(400)
			expect(userUpdateMock).not.toHaveBeenCalled()
		})

		it("returns 400 when tab is above the valid range", async () => {
			const accessToken = buildAccessToken(9, "session-tab-9")
			redisGetMock.mockResolvedValue(JSON.stringify({ userId: 9 }))

			const res = await request(app)
				.patch(PATH)
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ tab: 3 })

			expect(res.status).toBe(400)
			expect(userUpdateMock).not.toHaveBeenCalled()
		})

		it("persists a valid tab and returns it", async () => {
			const accessToken = buildAccessToken(10, "session-tab-10")
			redisGetMock.mockResolvedValue(JSON.stringify({ userId: 10 }))
			userUpdateMock.mockResolvedValue({ selected_tab: 2 })

			const res = await request(app)
				.patch(PATH)
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ tab: 2 })

			expect(res.status).toBe(200)
			expect(res.body.data).toMatchObject({ selected_tab: 2 })
			expect(userUpdateMock).toHaveBeenCalledWith({
				where: { id: BigInt(10) },
				data: { selected_tab: 2 }
			})
		})

		it("returns 500 when a database error occurs", async () => {
			const accessToken = buildAccessToken(11, "session-tab-11")
			redisGetMock.mockResolvedValue(JSON.stringify({ userId: 11 }))
			consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
			userUpdateMock.mockRejectedValue(new Error("Database connection error"))

			const res = await request(app)
				.patch(PATH)
				.set("Authorization", `Bearer ${accessToken}`)
				.send({ tab: 1 })

			expect(res.status).toBe(500)
			expect(res.body).toMatchObject({
				success: false,
				message: "Internal server error",
				status_code: 500
			})
			expect(consoleErrorSpy).toHaveBeenCalledWith("Update selected tab error:", expect.any(Error))
		})
	})
})
