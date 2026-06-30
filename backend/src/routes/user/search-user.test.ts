import express from "express"
import jwt from "jsonwebtoken"
import request from "supertest"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"

const redisGetMock = vi.fn()
const userFindManyMock = vi.fn()
const roomFindUniqueMock = vi.fn()

const PATH = "/api/user/search"

vi.mock("../../common/redis", () => ({
	default: {
		get: redisGetMock
	}
}))

vi.mock("prisma", () => ({
	default: {
		user: {
			findMany: userFindManyMock
		},
		room: {
			findUnique: roomFindUniqueMock
		}
	}
}))

describe("GET /api/user/search?query=:query", () => {
	let app: express.Express
	let consoleErrorSpy: ReturnType<typeof vi.spyOn>

	beforeAll(async () => {
		process.env.JWT_SECRET = "unit-test-secret"
		process.env.JWT_ISSUER = "unit-test-issuer"

		const { default: searchUserRoutes } = await import("./search-user")
		app = express()
		app.use(express.json())
		app.use("/api", searchUserRoutes)
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
		const res = await request(app).get(`${PATH}?query=alice`)

		expect(res.status).toBe(401)
		expect(res.body).toMatchObject({
			success: false,
			message: "auth-middleware.messages.token-required",
			status_code: 401
		})
		expect(userFindManyMock).not.toHaveBeenCalled()
	})

	it("returns 400 when search query is missing", async () => {
		const accessToken = buildAccessToken(1, "session-user-1")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 1 }))

		const res = await request(app)
			.get(PATH)
			.set("Authorization", `Bearer ${accessToken}`)

		expect(res.status).toBe(400)
		expect(res.body).toMatchObject({
			success: false,
			message: "Search query is required",
			status_code: 400
		})
		expect(userFindManyMock).not.toHaveBeenCalled()
	})

	it("returns 400 when search query is empty", async () => {
		const accessToken = buildAccessToken(1, "session-user-2")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 1 }))

		const res = await request(app)
			.get(`${PATH}?query=`)
			.set("Authorization", `Bearer ${accessToken}`)

		expect(res.status).toBe(400)
		expect(res.body).toMatchObject({
			success: false,
			message: "Search query is required",
			status_code: 400
		})
		expect(userFindManyMock).not.toHaveBeenCalled()
	})

	it("returns 400 when search query exceeds 100 characters", async () => {
		const accessToken = buildAccessToken(1, "session-user-3")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 1 }))
		const longQuery = "a".repeat(101)

		const res = await request(app)
			.get(`${PATH}?query=${encodeURIComponent(longQuery)}`)
			.set("Authorization", `Bearer ${accessToken}`)

		expect(res.status).toBe(400)
		expect(res.body).toMatchObject({
			success: false,
			message: "Search query is too long (max 100 characters)",
			status_code: 400
		})
		expect(userFindManyMock).not.toHaveBeenCalled()
	})

	it("returns 200 with empty array when no users match", async () => {
		const accessToken = buildAccessToken(1, "session-user-4")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 1 }))
		userFindManyMock.mockResolvedValue([])

		const res = await request(app)
			.get(`${PATH}?query=nonexistent`)
			.set("Authorization", `Bearer ${accessToken}`)

		expect(res.status).toBe(200)
		expect(res.body).toMatchObject({
			success: true,
			message: "Success",
			status_code: 200,
			data: []
		})
		expect(userFindManyMock).toHaveBeenCalledWith(
			expect.objectContaining({
				select: {
					id: true,
					display_name: true,
					avatar_seq: true,
					total_amount: true
				}
			})
		)
	})

	it("returns 200 with matching users (case-insensitive)", async () => {
		const accessToken = buildAccessToken(1, "session-user-5")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 1 }))

		userFindManyMock.mockResolvedValue([
			{
				id: BigInt(1),
				display_name: "Alice (current user)",
				avatar_seq: 1
			},
			{
				id: BigInt(101),
				display_name: "Alice",
				avatar_seq: 2
			},
			{
				id: BigInt(102),
				display_name: "alice123",
				avatar_seq: 3
			}
		])

		const res = await request(app)
			.get(`${PATH}?query=alice`)
			.set("Authorization", `Bearer ${accessToken}`)

		expect(res.status).toBe(200)
		// Current user (id: 1) should be excluded
		expect(res.body.data).toHaveLength(2)
		expect(res.body).toMatchObject({
			success: true,
			message: "Success",
			status_code: 200,
			data: [
				{
					id: 101,
					display_name: "Alice",
					avatar_url: "/images/101_2.jpg"
				},
				{
					id: 102,
					display_name: "alice123",
					avatar_url: "/images/102_3.jpg"
				}
			]
		})
	})

	it("returns 200 with matching users (searching without diacritical marks)", async () => {
		const accessToken = buildAccessToken(1, "session-user-5b")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 1 }))

		userFindManyMock.mockResolvedValue([
			{
				id: BigInt(1),
				display_name: "Hieu (current user)",
				avatar_seq: 0
			},
			{
				id: BigInt(201),
				display_name: "Hiếu",
				avatar_seq: 1
			},
			{
				id: BigInt(202),
				display_name: "Minh Hiếu",
				avatar_seq: 2
			},
			{
				id: BigInt(203),
				display_name: "Hieu Vu",
				avatar_seq: 3
			}
		])

		const res = await request(app)
			.get(`${PATH}?query=hieu`)
			.set("Authorization", `Bearer ${accessToken}`)

		expect(res.status).toBe(200)
		// Current user (id: 1) should be excluded
		expect(res.body.data).toHaveLength(3)
		expect(res.body.data[0].display_name).toBe("Hiếu")
		expect(res.body.data[1].display_name).toBe("Minh Hiếu")
		expect(res.body.data[2].display_name).toBe("Hieu Vu")
	})

	it("returns 200 with up to 10 results", async () => {
		const accessToken = buildAccessToken(1, "session-user-6")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 1 }))

		const mockUsers = [
			{
				id: BigInt(1),
				display_name: "User (current)",
				avatar_seq: 0
			},
			...Array.from({ length: 10 }, (_, i) => ({
				id: BigInt(100 + i),
				display_name: `User${i}`,
				avatar_seq: 1
			}))
		]

		userFindManyMock.mockResolvedValue(mockUsers)

		const res = await request(app)
			.get(`${PATH}?query=user`)
			.set("Authorization", `Bearer ${accessToken}`)

		expect(res.status).toBe(200)
		// Current user (id: 1) should be excluded, leaving 10 results
		expect(res.body.data).toHaveLength(10)
		expect(userFindManyMock).toHaveBeenCalledWith(
			expect.objectContaining({
				select: {
					id: true,
					display_name: true,
					avatar_seq: true,
					total_amount: true
				}
			})
		)
	})

	it("returns 200 with partial match results", async () => {
		const accessToken = buildAccessToken(1, "session-user-7")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 1 }))

		userFindManyMock.mockResolvedValue([
			{
				id: BigInt(1),
				display_name: "Alice (current user)",
				avatar_seq: 0
			},
			{
				id: BigInt(201),
				display_name: "AliceWonderland",
				avatar_seq: 1
			},
			{
				id: BigInt(202),
				display_name: "Bob Alice",
				avatar_seq: 2
			}
		])

		const res = await request(app)
			.get(`${PATH}?query=alice`)
			.set("Authorization", `Bearer ${accessToken}`)

		expect(res.status).toBe(200)
		// Current user (id: 1) should be excluded
		expect(res.body.data).toHaveLength(2)
		expect(res.body.data[0].display_name).toBe("AliceWonderland")
		expect(res.body.data[1].display_name).toBe("Bob Alice")
	})

	it("excludes current user from search results even if they match", async () => {
		const accessToken = buildAccessToken(5, "session-user-exclude")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 5 }))

		userFindManyMock.mockResolvedValue([
			{
				id: BigInt(5),
				display_name: "Minh Hieu",
				avatar_seq: 1
			},
			{
				id: BigInt(101),
				display_name: "Hieu Vu",
				avatar_seq: 2
			}
		])

		const res = await request(app)
			.get(`${PATH}?query=hieu`)
			.set("Authorization", `Bearer ${accessToken}`)

		expect(res.status).toBe(200)
		// Current user (id: 5) should be excluded even though they match "hieu"
		expect(res.body.data).toHaveLength(1)
		expect(res.body.data[0].id).toBe(101)
		expect(res.body.data[0].display_name).toBe("Hieu Vu")
	})

	it("excludes users who cannot afford the room's bet when roomId is provided (invite context)", async () => {
		const accessToken = buildAccessToken(1, "session-user-invite-1")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 1 }))
		roomFindUniqueMock.mockResolvedValue({ bet_amount: 100 })

		userFindManyMock.mockResolvedValue([
			// 100 > 200 * 0.8 (160)? No -> affordable, included.
			{ id: BigInt(101), display_name: "Rich Alice", avatar_seq: 1, total_amount: 200 },
			// 100 > 120 * 0.8 (96)? Yes -> too poor, excluded.
			{ id: BigInt(102), display_name: "Poor Alice", avatar_seq: 2, total_amount: 120 }
		])

		const res = await request(app)
			.get(`${PATH}?query=alice&roomId=55`)
			.set("Authorization", `Bearer ${accessToken}`)

		expect(res.status).toBe(200)
		expect(res.body.data).toHaveLength(1)
		expect(res.body.data[0].id).toBe(101)
		expect(roomFindUniqueMock).toHaveBeenCalledWith({
			where: { id: BigInt(55) },
			select: { bet_amount: true }
		})
	})

	it("does not filter by balance for chat search (no roomId)", async () => {
		const accessToken = buildAccessToken(1, "session-user-invite-2")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 1 }))

		userFindManyMock.mockResolvedValue([
			{ id: BigInt(101), display_name: "Rich Alice", avatar_seq: 1, total_amount: 200 },
			{ id: BigInt(102), display_name: "Poor Alice", avatar_seq: 2, total_amount: 1 }
		])

		const res = await request(app)
			.get(`${PATH}?query=alice`)
			.set("Authorization", `Bearer ${accessToken}`)

		expect(res.status).toBe(200)
		expect(res.body.data).toHaveLength(2)
		expect(roomFindUniqueMock).not.toHaveBeenCalled()
	})

	it("does not filter by balance when the room is free (bet_amount 0)", async () => {
		const accessToken = buildAccessToken(1, "session-user-invite-3")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 1 }))
		roomFindUniqueMock.mockResolvedValue({ bet_amount: 0 })

		userFindManyMock.mockResolvedValue([
			{ id: BigInt(101), display_name: "Rich Alice", avatar_seq: 1, total_amount: 200 },
			{ id: BigInt(102), display_name: "Poor Alice", avatar_seq: 2, total_amount: 1 }
		])

		const res = await request(app)
			.get(`${PATH}?query=alice&roomId=55`)
			.set("Authorization", `Bearer ${accessToken}`)

		expect(res.status).toBe(200)
		expect(res.body.data).toHaveLength(2)
	})

	it("returns 500 when unexpected error happens", async () => {
		const accessToken = buildAccessToken(1, "session-user-8")
		consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined)
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 1 }))
		userFindManyMock.mockRejectedValue(new Error("db down"))

		const res = await request(app)
			.get(`${PATH}?query=alice`)
			.set("Authorization", `Bearer ${accessToken}`)

		expect(res.status).toBe(500)
		expect(res.body).toMatchObject({
			success: false,
			message: "Internal server error",
			status_code: 500
		})
	})
})
