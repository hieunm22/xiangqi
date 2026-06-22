import express from "express"
import jwt from "jsonwebtoken"
import request from "supertest"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"

const redisGetMock = vi.fn()
const roomFindManyMock = vi.fn()

const PATH = "/api/room/fetch-rooms"

vi.mock("../../common/redis", () => ({
	default: {
		get: redisGetMock
	}
}))

vi.mock("prisma", () => ({
	default: {
		room: {
			findMany: roomFindManyMock
		}
	}
}))

describe("GET /api/room/fetch-rooms", () => {
	let app: express.Express
	let consoleErrorSpy: ReturnType<typeof vi.spyOn>

	beforeAll(async () => {
		process.env.JWT_SECRET = "unit-test-secret"
		process.env.JWT_ISSUER = "unit-test-issuer"

		const { default: fetchRoomsRoutes } = await import("./fetch-rooms")
		app = express()
		app.use(express.json())
		app.use("/api", fetchRoomsRoutes)
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

	it("returns 401 when authorization token is missing", async () => {
		const res = await request(app).get(PATH)

		expect(res.status).toBe(401)
		expect(res.body).toMatchObject({
			success: false,
			message: "auth-middleware.messages.token-required",
			status_code: 401
		})
	})

	it("returns 400 when status query is not an integer", async () => {
		const accessToken = buildAccessToken(21, "session-fetch-2")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 21 }))

		const res = await request(app)
			.get(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.query({ status: "abc" })

		expect(res.status).toBe(400)
		expect(res.body).toMatchObject({
			success: false,
			message: "fetch-rooms.messages.invalid-status",
			status_code: 400,
			rooms: []
		})
		expect(roomFindManyMock).not.toHaveBeenCalled()
	})

	it("returns 200 and fetches all rooms when no status filter is provided", async () => {
		const accessToken = buildAccessToken(21, "session-fetch-3")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 21 }))
		roomFindManyMock.mockResolvedValue([
			{
				id: BigInt(101),
				name: "Table A",
				status: 1,
				red_first: true,
				bet_amount: 50,
				host_id: BigInt(12),
				created_at: new Date("2026-05-12T00:00:00.000Z"),
				updated_at: new Date("2026-05-12T00:00:00.000Z"),
				room_users: [
					{
						team: "red",
						users: {
							id: BigInt(11),
							display_name: "Alice",
							avatar_seq: 0
						}
					},
					{
						team: "black",
						users: {
							id: BigInt(12),
							display_name: "Bob",
							avatar_seq: 2
						}
					}
				]
			}
		])

		const res = await request(app).get(PATH).set("Authorization", `Bearer ${accessToken}`)

		expect(res.status).toBe(200)
		expect(res.body).toMatchObject({
			success: true,
			message: "fetch-rooms.messages.success",
			status_code: 200
		})
		expect(res.body.data).toHaveLength(1)
		expect(res.body.data[0]).toMatchObject({
			id: 101,
			name: "Table A",
			status: 1,
			red_first: true,
			bet_amount: 50,
			// host is independent of join order (Alice joined first, Bob is host)
			host_id: 12
		})
		expect(res.body.data[0].users).toHaveLength(2)
		expect(res.body.data[0].users[0]).toMatchObject({
			id: 11,
			display_name: "Alice",
			avatar_seq: 0,
			avatar_url: "/images/11.jpg",
			team: "red"
		})
		expect(res.body.data[0].users[1]).toMatchObject({
			id: 12,
			display_name: "Bob",
			avatar_seq: 2,
			avatar_url: "/images/12_2.jpg",
			team: "black"
		})

		expect(roomFindManyMock).toHaveBeenCalledTimes(1)
		expect(roomFindManyMock).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { is_active: true },
				orderBy: { created_at: "asc" },
				select: expect.objectContaining({
					id: true,
					name: true,
					status: true,
					host_id: true,
					room_users: expect.objectContaining({
						select: expect.objectContaining({
							team: true,
							users: expect.any(Object)
						})
					})
				})
			})
		)
	})

	it("returns 200 and fetches rooms by status filter", async () => {
		const accessToken = buildAccessToken(21, "session-fetch-4")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 21 }))
		roomFindManyMock.mockResolvedValue([])

		const res = await request(app)
			.get(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.query({ status: 2 })

		expect(res.status).toBe(200)
		expect(res.body).toMatchObject({
			success: true,
			message: "fetch-rooms.messages.success",
			status_code: 200,
			data: []
		})
		expect(roomFindManyMock).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { is_active: true, status: 2 },
				orderBy: { created_at: "asc" }
			})
		)
	})

	it("returns 500 when unexpected error happens", async () => {
		const accessToken = buildAccessToken(21, "session-fetch-5")
		consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined)
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 21 }))
		roomFindManyMock.mockRejectedValue(new Error("db down"))

		const res = await request(app).get(PATH).set("Authorization", `Bearer ${accessToken}`)

		expect(res.status).toBe(500)
		expect(res.body).toMatchObject({
			success: false,
			message: "fetch-rooms.messages.internal-server-error",
			status_code: 500,
			rooms: []
		})
	})
})