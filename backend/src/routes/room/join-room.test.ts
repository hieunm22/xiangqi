import express from "express"
import jwt from "jsonwebtoken"
import request from "supertest"
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

const redisGetMock = vi.fn()
const roomFindUniqueMock = vi.fn()
const roomFindManyMock = vi.fn()
const roomUserDeleteManyMock = vi.fn()
const roomUserFindUniqueMock = vi.fn()
const roomUserUpdateMock = vi.fn()
const roomUserFindManyMock = vi.fn()
const roomUserCreateMock = vi.fn()
const userFindUniqueMock = vi.fn()
const leaveRoomEffectMock = vi.fn()

const PATH = "/api/room/join"

vi.mock("../../common/redis", () => ({
	default: {
		get: redisGetMock
	}
}))

vi.mock("prisma", () => ({
	default: {
		room: {
			findUnique: roomFindUniqueMock,
			findMany: roomFindManyMock
		},
		user: {
			findUnique: userFindUniqueMock
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

// The route delegates leaving the user's other rooms to this helper (covered by
// leave-room.test.ts); here we stub it and default the "other rooms" lookup to empty
vi.mock("../../common/game/leave-room.helper", () => ({
	leaveRoomEffect: leaveRoomEffectMock
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

	beforeEach(() => {
		// By default the user is in no other room, so no cross-room leave happens.
		roomFindManyMock.mockResolvedValue([])
		leaveRoomEffectMock.mockResolvedValue("left")
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

	it("returns 400 when team is invalid", async () => {
		const accessToken = buildAccessToken(41, "session-join-invalid-team")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 41 }))

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({ id: 101, team: "green" })

		expect(res.status).toBe(400)
		expect(res.body).toMatchObject({
			success: false,
			message: "join-room.messages.invalid-team",
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
		roomFindUniqueMock.mockResolvedValue({ id: BigInt(101), pve_mode: false })
		roomUserDeleteManyMock.mockResolvedValue({ count: 0 })
		roomUserFindUniqueMock.mockResolvedValue({ room_id: BigInt(101), user_id: BigInt(41) })
		roomUserUpdateMock.mockResolvedValue({})
		roomUserFindManyMock
			.mockResolvedValueOnce([
				{
					team: "red",
					user_id: BigInt(41)
				}
			])
			.mockResolvedValueOnce([
				{
					joined_at: new Date("2026-05-12T00:00:00.000Z"),
					team: "red",
					users: {
						id: BigInt(41),
						display_name: "Alice",
						avatar_seq: 0,
						is_bot: false
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
			team: "red",
			is_bot: false
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
					joined_at: expect.any(Date),
					team: "red"
				}
			})
		)
		expect(roomUserCreateMock).not.toHaveBeenCalled()
	})

	it("assigns requested red team when team is explicitly red", async () => {
		const accessToken = buildAccessToken(44, "session-join-team-red")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 44 }))
		roomFindUniqueMock.mockResolvedValue({ id: BigInt(101), pve_mode: false })
		roomUserDeleteManyMock.mockResolvedValue({ count: 0 })
		roomUserFindUniqueMock.mockResolvedValue(null)
		roomUserFindManyMock
			.mockResolvedValueOnce([{ team: "black", user_id: BigInt(42) }])
			.mockResolvedValueOnce([
				{
					joined_at: new Date("2026-05-12T00:00:00.000Z"),
					team: "black",
					users: {
						id: BigInt(42),
						display_name: "Bob",
						avatar_seq: 0
					}
				},
				{
					joined_at: new Date("2026-05-12T00:01:00.000Z"),
					team: "red",
					users: {
						id: BigInt(44),
						display_name: "Daisy",
						avatar_seq: 1
					}
				}
			])
		roomUserCreateMock.mockResolvedValue({})

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({ id: 101, team: "red" })

		expect(res.status).toBe(201)
		expect(res.body.data[1]).toMatchObject({
			id: 44,
			team: "red"
		})
		expect(roomUserCreateMock).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					team: "red"
				})
			})
		)
	})

	it("assigns spectator when team is explicitly null", async () => {
		const accessToken = buildAccessToken(45, "session-join-team-null")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 45 }))
		roomFindUniqueMock.mockResolvedValue({ id: BigInt(101), pve_mode: false })
		roomUserDeleteManyMock.mockResolvedValue({ count: 0 })
		roomUserFindUniqueMock.mockResolvedValue(null)
		roomUserFindManyMock
			.mockResolvedValueOnce([
				{ team: "red", user_id: BigInt(41) },
				{ team: "black", user_id: BigInt(42) }
			])
			.mockResolvedValueOnce([
				{
					joined_at: new Date("2026-05-12T00:00:00.000Z"),
					team: "red",
					users: {
						id: BigInt(41),
						display_name: "Alice",
						avatar_seq: 0,
						is_bot: false
					}
				},
				{
					joined_at: new Date("2026-05-12T00:00:30.000Z"),
					team: "black",
					users: {
						id: BigInt(42),
						display_name: "Bob",
						avatar_seq: 2
					}
				},
				{
					joined_at: new Date("2026-05-12T00:01:00.000Z"),
					team: null,
					users: {
						id: BigInt(45),
						display_name: "Eve",
						avatar_seq: 1
					}
				}
			])
		roomUserCreateMock.mockResolvedValue({})

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({ id: 101, team: null })

		expect(res.status).toBe(201)
		expect(res.body.data[2]).toMatchObject({
			id: 45,
			team: null
		})
		expect(roomUserCreateMock).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					team: null
				})
			})
		)
	})

	it("returns 409 when requested team seat is occupied by another user", async () => {
		const accessToken = buildAccessToken(46, "session-join-team-occupied")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 46 }))
		roomFindUniqueMock.mockResolvedValue({ id: BigInt(101), pve_mode: false })
		roomUserDeleteManyMock.mockResolvedValue({ count: 0 })
		roomUserFindUniqueMock.mockResolvedValue(null)
		roomUserFindManyMock.mockResolvedValueOnce([{ team: "red", user_id: BigInt(41) }])

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({ id: 101, team: "red" })

		expect(res.status).toBe(409)
		expect(res.body).toMatchObject({
			success: false,
			message: "join-room.messages.team-seat-occupied",
			status_code: 409
		})
		expect(roomUserCreateMock).not.toHaveBeenCalled()
		expect(roomUserUpdateMock).not.toHaveBeenCalled()
	})

	it("assigns red team when no team is assigned yet in PVP room", async () => {
		const accessToken = buildAccessToken(42, "session-join-4")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 42 }))
		roomFindUniqueMock.mockResolvedValue({ id: BigInt(101), pve_mode: false })
		roomUserDeleteManyMock.mockResolvedValue({ count: 1 })
		roomUserFindUniqueMock.mockResolvedValue(null)
		roomUserFindManyMock
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([
				{
					joined_at: new Date("2026-05-12T00:01:00.000Z"),
					team: "red",
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
		expect(res.body.data[0]).toMatchObject({
			id: 42,
			display_name: "Bob",
			team: "red"
		})

		expect(roomUserCreateMock).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					team: "red"
				})
			})
		)
	})

	it("assigns black team when red is taken in PVP room", async () => {
		const accessToken = buildAccessToken(42, "session-join-4b")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 42 }))
		roomFindUniqueMock.mockResolvedValue({ id: BigInt(101), pve_mode: false })
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
						avatar_seq: 0,
						is_bot: false
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
		expect(res.body.data[1]).toMatchObject({
			id: 42,
			team: "black"
		})

		expect(roomUserCreateMock).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					team: "black"
				})
			})
		)
	})

	it("assigns spectator (null) when both teams are taken in PVP room", async () => {
		const accessToken = buildAccessToken(43, "session-join-4c")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 43 }))
		roomFindUniqueMock.mockResolvedValue({ id: BigInt(101), pve_mode: false })
		roomUserDeleteManyMock.mockResolvedValue({ count: 1 })
		roomUserFindUniqueMock.mockResolvedValue(null)
		roomUserFindManyMock
			.mockResolvedValueOnce([
				{ team: "red" },
				{ team: "black" }
			])
			.mockResolvedValueOnce([
				{
					joined_at: new Date("2026-05-12T00:00:00.000Z"),
					team: "red",
					users: {
						id: BigInt(41),
						display_name: "Alice",
						avatar_seq: 0,
						is_bot: false
					}
				},
				{
					joined_at: new Date("2026-05-12T00:00:30.000Z"),
					team: "black",
					users: {
						id: BigInt(42),
						display_name: "Bob",
						avatar_seq: 2
					}
				},
				{
					joined_at: new Date("2026-05-12T00:01:00.000Z"),
					team: null,
					users: {
						id: BigInt(43),
						display_name: "Charlie",
						avatar_seq: 1
					}
				}
			])
		roomUserCreateMock.mockResolvedValue({})

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({ id: 101 })

		expect(res.status).toBe(201)
		expect(res.body.data[2]).toMatchObject({
			id: 43,
			team: null
		})

		expect(roomUserCreateMock).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					team: null
				})
			})
		)
	})

	it("returns 201 and assigns spectator team for new user joining PVE room", async () => {
		const accessToken = buildAccessToken(42, "session-join-6")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 42 }))
		roomFindUniqueMock.mockResolvedValue({ id: BigInt(201), pve_mode: true })
		roomUserDeleteManyMock.mockResolvedValue({ count: 0 })
		roomUserFindUniqueMock.mockResolvedValue(null)
		roomUserFindManyMock.mockResolvedValueOnce([
			{
				joined_at: new Date("2026-05-12T00:01:00.000Z"),
				team: null,
				users: {
					id: BigInt(42),
					display_name: "Bob",
					avatar_seq: 0
				}
			}
		])
		roomUserCreateMock.mockResolvedValue({})

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({ id: 201 })

		expect(res.status).toBe(201)
		expect(res.body).toMatchObject({
			success: true,
			message: "join-room.messages.success",
			status_code: 201
		})
		expect(res.body.data[0]).toMatchObject({ team: null })

		// Should NOT query existing members for team assignment
		expect(roomUserFindManyMock).toHaveBeenCalledTimes(1)

		expect(roomUserCreateMock).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					team: null
				})
			})
		)
	})

	it("returns 201 and keeps spectator team when re-joining PVE room with only one existing player slot", async () => {
		const accessToken = buildAccessToken(41, "session-join-7")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 41 }))
		// PVE room with only 1 member slot taken — user is already in the room
		roomFindUniqueMock.mockResolvedValue({ id: BigInt(201), pve_mode: true })
		roomUserDeleteManyMock.mockResolvedValue({ count: 0 })
		roomUserFindUniqueMock.mockResolvedValue({ room_id: BigInt(201), user_id: BigInt(41) })
		roomUserUpdateMock.mockResolvedValue({})
		roomUserFindManyMock.mockResolvedValueOnce([
			{
				joined_at: new Date("2026-05-12T00:00:00.000Z"),
				team: null,
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
			.send({ id: 201 })

		expect(res.status).toBe(201)
		expect(res.body.data[0]).toMatchObject({ team: null })

		expect(roomUserUpdateMock).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					team: null
				})
			})
		)
		expect(roomUserCreateMock).not.toHaveBeenCalled()
	})

	it("returns 400 when user cannot afford bet joining as player", async () => {
		const accessToken = buildAccessToken(51, "session-join-insufficient-balance")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 51 }))
		// 100 bet vs 120 balance: 100 * 10 > 120 * 8 (1000 > 960) -> blocked
		roomFindUniqueMock.mockResolvedValue({
			id: BigInt(101),
			pve_mode: false,
			bet_amount: 100
		})
		userFindUniqueMock.mockResolvedValue({ total_amount: 120 })

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({ id: 101, team: "red" })

		expect(res.status).toBe(400)
		expect(res.body).toMatchObject({
			success: false,
			message: "join-room.messages.insufficient-amount",
			status_code: 400
		})
		expect(roomUserCreateMock).not.toHaveBeenCalled()
		expect(userFindUniqueMock).toHaveBeenCalledWith({
			where: { id: BigInt(51) },
			select: { total_amount: true }
		})
	})

	it("returns 201 when user can afford bet joining as player", async () => {
		const accessToken = buildAccessToken(52, "session-join-sufficient-balance")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 52 }))
		// 100 bet vs 200 balance: 100 * 10 <= 200 * 8 (1000 <= 1600) -> allowed
		roomFindUniqueMock.mockResolvedValue({
			id: BigInt(102),
			pve_mode: false,
			bet_amount: 100
		})
		userFindUniqueMock.mockResolvedValue({ total_amount: 200 })
		roomUserDeleteManyMock.mockResolvedValue({ count: 0 })
		roomUserFindUniqueMock.mockResolvedValue(null)
		// Mock existing members (no one in room yet)
		roomUserFindManyMock.mockResolvedValue([])
		roomUserCreateMock.mockResolvedValue({
			room_id: BigInt(102),
			user_id: BigInt(52),
			team: "red",
			joined_at: new Date("2026-06-29T00:00:00Z")
		})
		// After creation, fetch all users
		roomUserFindManyMock.mockResolvedValueOnce([])
		roomUserFindManyMock.mockResolvedValueOnce([
			{
				joined_at: new Date("2026-06-29T00:00:00Z"),
				team: "red",
				users: {
					id: BigInt(52),
					display_name: "Rich Player",
					avatar_seq: 1,
					total_amount: 200
				}
			}
		])

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({ id: 102, team: "red" })

		expect(res.status).toBe(201)
		expect(res.body).toMatchObject({
			success: true,
			message: "join-room.messages.success",
			status_code: 201
		})
		expect(res.body.data).toHaveLength(1)
		expect(res.body.data[0]).toMatchObject({
			id: 52,
			team: "red",
			total_amount: 200
		})
	})

	it("returns 201 when user at exactly 80% threshold joining as player", async () => {
		const accessToken = buildAccessToken(53, "session-join-threshold")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 53 }))
		// 100 bet vs 125 balance: 100 * 10 <= 125 * 8 (1000 <= 1000) -> allowed
		roomFindUniqueMock.mockResolvedValue({
			id: BigInt(103),
			pve_mode: false,
			bet_amount: 100
		})
		userFindUniqueMock.mockResolvedValue({ total_amount: 125 })
		roomUserDeleteManyMock.mockResolvedValue({ count: 0 })
		roomUserFindUniqueMock.mockResolvedValue(null)
		// Mock existing members (no one in room yet)
		roomUserFindManyMock.mockResolvedValueOnce([])
		roomUserCreateMock.mockResolvedValue({
			room_id: BigInt(103),
			user_id: BigInt(53),
			team: "black",
			joined_at: new Date("2026-06-29T00:00:00Z")
		})
		// After creation, fetch all users
		roomUserFindManyMock.mockResolvedValueOnce([
			{
				joined_at: new Date("2026-06-29T00:00:00Z"),
				team: "black",
				users: {
					id: BigInt(53),
					display_name: "Threshold Player",
					avatar_seq: 2,
					total_amount: 125
				}
			}
		])

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({ id: 103, team: "black" })

		expect(res.status).toBe(201)
		expect(res.body).toMatchObject({
			success: true,
			message: "join-room.messages.success",
			status_code: 201
		})
	})

	it("returns 201 and skips balance check when joining as spectator with low balance", async () => {
		const accessToken = buildAccessToken(54, "session-join-spectator-balance")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 54 }))
		roomFindUniqueMock.mockResolvedValue({
			id: BigInt(104),
			pve_mode: false,
			bet_amount: 100
		})
		roomUserDeleteManyMock.mockResolvedValue({ count: 0 })
		roomUserFindUniqueMock.mockResolvedValue(null)
		roomUserFindManyMock.mockResolvedValue([
			{
				joined_at: new Date("2026-06-29T00:00:00Z"),
				team: null,
				users: {
					id: BigInt(54),
					display_name: "Poor Spectator",
					avatar_seq: 3,
					total_amount: 50
				}
			}
		])

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({ id: 104, team: null })

		expect(res.status).toBe(201)
		expect(res.body).toMatchObject({
			success: true,
			message: "join-room.messages.success",
			status_code: 201
		})
		// userFindUniqueMock should NOT be called for spectator join
		expect(userFindUniqueMock).not.toHaveBeenCalled()
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

	it("leaves the user's other rooms via leaveRoomEffect before joining", async () => {
		const accessToken = buildAccessToken(41, "session-join-other-rooms")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 41 }))
		roomFindUniqueMock.mockResolvedValue({ id: BigInt(101), pve_mode: false })
		roomUserFindUniqueMock.mockResolvedValue(null)
		// The user is still a member of rooms 202 and 203.
		roomFindManyMock.mockResolvedValue([{ id: BigInt(202) }, { id: BigInt(203) }])
		roomUserFindManyMock
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([
				{
					joined_at: new Date("2026-05-12T00:00:00.000Z"),
					team: null,
					users: { id: BigInt(41), display_name: "Alice", avatar_seq: 0, is_bot: false }
				}
			])
		roomUserCreateMock.mockResolvedValue({})

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({ id: 101, team: null })

		expect(res.status).toBe(201)
		// Other-room lookup excludes the room being joined.
		expect(roomFindManyMock).toHaveBeenCalledWith({
			where: {
				id: { not: BigInt(101) },
				room_users: { some: { user_id: BigInt(41) } }
			},
			select: { id: true }
		})
		// Each other room is left through the shared leave path.
		expect(leaveRoomEffectMock).toHaveBeenCalledTimes(2)
		expect(leaveRoomEffectMock).toHaveBeenCalledWith(BigInt(202), BigInt(41))
		expect(leaveRoomEffectMock).toHaveBeenCalledWith(BigInt(203), BigInt(41))
	})
})