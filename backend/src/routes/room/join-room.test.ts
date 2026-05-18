import express from "express"
import jwt from "jsonwebtoken"
import request from "supertest"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"

const redisGetMock = vi.fn()
const roomFindUniqueMock = vi.fn()
const roomUserDeleteManyMock = vi.fn()
const roomUserFindUniqueMock = vi.fn()
const roomUserUpdateMock = vi.fn()
const roomUserFindManyMock = vi.fn()
const roomUserCreateMock = vi.fn()

const PATH = "/api/room/join"

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
			deleteMany: roomUserDeleteManyMock,
			findUnique: roomUserFindUniqueMock,
			update: roomUserUpdateMock,
			findMany: roomUserFindManyMock,
			create: roomUserCreateMock
		}
	}
}))

describe("POST /api/room/join", () => {
	let app: express.Express
	let consoleErrorSpy: ReturnType<typeof vi.spyOn>

	beforeAll(async () => {
		process.env.JWT_SECRET = "unit-test-secret"
		process.env.JWT_ISSUER = "unit-test-issuer"

		const { default: joinRoomRoutes } = await import("./join-room")
		app = express()
		app.use(express.json())
		app.use("/api", joinRoomRoutes)
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
		const res = await request(app).post(PATH).send({ id: 101 })

		expect(res.status).toBe(401)
		expect(res.body).toMatchObject({
			success: false,
			message: "auth-middleware.messages.token-required",
			status_code: 401
		})
	})

	it("returns 400 when room id is invalid", async () => {
		const accessToken = buildAccessToken(41, "session-join-1")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 41 }))

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({ id: "abc" })

		expect(res.status).toBe(400)
		expect(res.body).toMatchObject({
			success: false,
			message: "join-room.messages.invalid-room-id",
			status_code: 400
		})
		expect(roomFindUniqueMock).not.toHaveBeenCalled()
	})

	it("returns 404 when room does not exist", async () => {
		const accessToken = buildAccessToken(41, "session-join-2")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 41 }))
		roomFindUniqueMock.mockResolvedValue(null)

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({ id: 101 })

		expect(res.status).toBe(404)
		expect(res.body).toMatchObject({
			success: false,
			message: "join-room.messages.room-not-found",
			status_code: 404
		})
	})

	it("returns 201 and refreshes join time when user already in room", async () => {
		const accessToken = buildAccessToken(41, "session-join-3")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 41 }))
		roomFindUniqueMock.mockResolvedValue({ id: BigInt(101) })
		roomUserDeleteManyMock.mockResolvedValue({ count: 0 })
		roomUserFindUniqueMock.mockResolvedValue({ room_id: BigInt(101), user_id: BigInt(41) })
		roomUserUpdateMock.mockResolvedValue({})
		roomUserFindManyMock.mockResolvedValue([
			{
				joined_at: new Date("2026-05-12T00:00:00.000Z"),
				team: "red",
				users: {
					id: BigInt(41),
					display_name: "Alice",
					avatar_seq: 0
				}
			}
		])

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({ id: 101 })

		expect(res.status).toBe(201)
		expect(res.body).toMatchObject({
			success: true,
			message: "join-room.messages.success",
			status_code: 201
		})
		expect(res.body.data).toHaveLength(1)
		expect(res.body.data[0]).toMatchObject({
			id: 41,
			display_name: "Alice",
			avatar_seq: 0,
			avatar_url: "/images/41.jpg",
			team: "red"
		})

		expect(roomUserUpdateMock).toHaveBeenCalledWith(
			expect.objectContaining({
				where: {
					room_id_user_id: {
						room_id: BigInt(101),
						user_id: BigInt(41)
					}
				},
				data: {
					joined_at: expect.any(Date)
				}
			})
		)
		expect(roomUserCreateMock).not.toHaveBeenCalled()
	})

	it("returns 201 and assigns opposite team for second user", async () => {
		const accessToken = buildAccessToken(42, "session-join-4")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 42 }))
		roomFindUniqueMock.mockResolvedValue({ id: BigInt(101) })
		roomUserDeleteManyMock.mockResolvedValue({ count: 1 })
		roomUserFindUniqueMock.mockResolvedValue(null)
		roomUserFindManyMock
			.mockResolvedValueOnce([{ team: "red" }])
			.mockResolvedValueOnce([
				{
					joined_at: new Date("2026-05-12T00:00:00.000Z"),
					team: "red",
					users: {
						id: BigInt(41),
						display_name: "Alice",
						avatar_seq: 0
					}
				},
				{
					joined_at: new Date("2026-05-12T00:01:00.000Z"),
					team: "black",
					users: {
						id: BigInt(42),
						display_name: "Bob",
						avatar_seq: 2
					}
				}
			])
		roomUserCreateMock.mockResolvedValue({})

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({ id: 101 })

		expect(res.status).toBe(201)
		expect(res.body).toMatchObject({
			success: true,
			message: "join-room.messages.success",
			status_code: 201
		})
		expect(res.body.data).toHaveLength(2)
		expect(res.body.data[1]).toMatchObject({
			id: 42,
			display_name: "Bob",
			avatar_seq: 2,
			avatar_url: "/images/42_2.jpg",
			team: "black"
		})

		expect(roomUserCreateMock).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					room_id: BigInt(101),
					user_id: BigInt(42),
					team: "black",
					joined_at: expect.any(Date)
				})
			})
		)
	})

	it("returns 500 when unexpected error happens", async () => {
		const accessToken = buildAccessToken(41, "session-join-5")
		consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined)
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 41 }))
		roomFindUniqueMock.mockRejectedValue(new Error("db down"))

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({ id: 101 })

		expect(res.status).toBe(500)
		expect(res.body).toMatchObject({
			success: false,
			message: "join-room.messages.internal-server-error",
			status_code: 500
		})
	})
})