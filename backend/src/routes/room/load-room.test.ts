import express from "express"
import jwt from "jsonwebtoken"
import request from "supertest"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"

const redisGetMock = vi.fn()
const roomFindUniqueMock = vi.fn()
const roomUserFindUniqueMock = vi.fn()
const countDocumentsMock = vi.fn()
const getChatMessageCollectionMock = vi.fn()
const computeClockMock = vi.fn()

const PATH = "/api/room/info"

vi.mock("../../common/redis", () => ({
	default: {
		get: redisGetMock
	}
}))

vi.mock("prisma", () => ({
	default: {
		room: {
			findUnique: roomFindUniqueMock
		},
		roomUser: {
			findUnique: roomUserFindUniqueMock
		}
	}
}))

vi.mock("../../common/mongodb", () => ({
	getChatMessageCollection: getChatMessageCollectionMock
}))

vi.mock("common/game/game-clock", () => ({
	computeClock: computeClockMock
}))

describe("GET /api/room/info?id=:id", () => {
	let app: express.Express
	let consoleErrorSpy: ReturnType<typeof vi.spyOn>

	beforeAll(async () => {
		process.env.JWT_SECRET = "unit-test-secret"
		process.env.JWT_ISSUER = "unit-test-issuer"

		const { default: loadRoomRoutes } = await import("./load-room")
		app = express()
		app.use(express.json())
		app.use("/api", loadRoomRoutes)
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
		const res = await request(app).get(`${PATH}?id=101`)

		expect(res.status).toBe(401)
		expect(res.body).toMatchObject({
			success: false,
			message: "auth-middleware.messages.token-required",
			status_code: 401
		})
	})

	it("returns 400 when room id is invalid", async () => {
		const accessToken = buildAccessToken(31, "session-room-info-1")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 31 }))

		const res = await request(app)
			.get(`${PATH}?id=abc`)
			.set("Authorization", `Bearer ${accessToken}`)

		expect(res.status).toBe(400)
		expect(res.body).toMatchObject({
			success: false,
			message: "load-room.messages.invalid-room-id",
			status_code: 400
		})
		expect(roomFindUniqueMock).not.toHaveBeenCalled()
	})

	it("returns 404 when room is not found", async () => {
		const accessToken = buildAccessToken(31, "session-room-info-2")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 31 }))
		roomFindUniqueMock.mockResolvedValue(null)

		const res = await request(app)
			.get(`${PATH}?id=101`)
			.set("Authorization", `Bearer ${accessToken}`)

		expect(res.status).toBe(404)
		expect(res.body).toMatchObject({
			success: false,
			message: "load-room.messages.room-not-found",
			status_code: 404,
			data: null
		})
	})

	it("returns 200 and room details when room exists", async () => {
		const accessToken = buildAccessToken(31, "session-room-info-3")
		const joinedAt = new Date("2026-05-12T10:00:00.000Z")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 31 }))
		roomUserFindUniqueMock.mockResolvedValue({ joined_at: joinedAt })
		countDocumentsMock.mockResolvedValue(4)
		getChatMessageCollectionMock.mockResolvedValue({ countDocuments: countDocumentsMock })
		computeClockMock.mockResolvedValue({
			redMs: 300000,
			blackMs: 250000,
			activeTeam: "red",
			serverNow: 1700000000000,
			timeLimit: 600,
			timeIncrement: 0
		})
		roomFindUniqueMock.mockResolvedValue({
			id: BigInt(101),
			name: "Final Table",
			status: 2,
			red_first: false,
			bet_amount: 100,
			time_limit: 600,
			time_increment: 5,
			time_per_move: 30,
			host_id: BigInt(12),
			created_at: new Date("2026-05-12T00:00:00.000Z"),
			updated_at: new Date("2026-05-12T00:00:00.000Z"),
			games: [
				{
					id: "game-101",
					room_id: BigInt(101),
					winner_id: BigInt(11),
					status: 1,
					bot_difficulty: null
				}
			],
			room_users: [
				{
					users: {
						id: BigInt(11),
						display_name: "Alice",
						avatar_seq: 0,
						is_bot: false
					},
					team: "red"
				},
				{
					users: {
						id: BigInt(12),
						display_name: "Bob",
						avatar_seq: 3,
						is_bot: false
					},
					team: "black"
				}
			]
		})

		const res = await request(app)
			.get(`${PATH}?id=101`)
			.set("Authorization", `Bearer ${accessToken}`)

		expect(res.status).toBe(200)
		expect(res.body).toMatchObject({
			success: true,
			message: "load-room.messages.success",
			status_code: 200,
			data: {
				game: {
					id: "game-101",
					room_id: 101,
					winner_id: 11,
					status: 1,
					bot_difficulty: null
				},
				room: {
					id: 101,
					name: "Final Table",
					status: 2,
					red_first: false,
					bet_amount: 100,
					time_limit: 600,
					time_increment: 5,
					time_per_move: 30,
					host_id: 12
				},
				chat: {
					unread_count: 4
				},
				users: expect.any(Array),
				clock: {
					redMs: 300000,
					blackMs: 250000,
					activeTeam: "red",
					timeLimit: 600
				}
			}
		})
		expect(computeClockMock).toHaveBeenCalledWith("game-101")
		expect(countDocumentsMock).toHaveBeenCalledWith({
			room_id: 101,
			timestamp: { $gt: joinedAt },
			read_by: { $nin: [31] }
		})
		expect(res.body.data.users).toHaveLength(2)
		expect(res.body.data.users[0]).toMatchObject({
			id: 11,
			display_name: "Alice",
			team: "red",
			avatar_url: "/images/11.jpg",
			is_bot: false
		})
		expect(res.body.data.users[1]).toMatchObject({
			id: 12,
			display_name: "Bob",
			team: "black",
			avatar_url: "/images/12_3.jpg",
			is_bot: false
		})

		expect(roomFindUniqueMock).toHaveBeenCalledWith(
			expect.objectContaining({
				where: expect.objectContaining({ id: BigInt(101) }),
				select: expect.any(Object)
			})
		)
	})

	it("returns 500 when unexpected error happens", async () => {
		const accessToken = buildAccessToken(31, "session-room-info-4")
		consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined)
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 31 }))
		roomFindUniqueMock.mockRejectedValue(new Error("db down"))

		const res = await request(app)
			.get(`${PATH}?id=101`)
			.set("Authorization", `Bearer ${accessToken}`)

		expect(res.status).toBe(500)
		expect(res.body).toMatchObject({
			success: false,
			message: "load-room.messages.internal-server-error",
			status_code: 500,
			data: null
		})
	})
})
