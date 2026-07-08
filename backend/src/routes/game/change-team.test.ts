import express from "express"
import jwt from "jsonwebtoken"
import request from "supertest"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"

const redisGetMock = vi.fn()
const roomFindUniqueMock = vi.fn()
const roomUserFindManyMock = vi.fn()
const roomUserUpdateMock = vi.fn()
const userFindUniqueMock = vi.fn()
const emitRoomUsersUpdatedMock = vi.fn()

const PATH = "/api/game/change-team"

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
			findMany: roomUserFindManyMock,
			update: roomUserUpdateMock
		},
		user: {
			findUnique: userFindUniqueMock
		}
	}
}))

vi.mock("common/socket", () => ({
	emitRoomUsersUpdated: emitRoomUsersUpdatedMock
}))

describe("POST /api/game/change-team", () => {
	let app: express.Express
	let consoleErrorSpy: ReturnType<typeof vi.spyOn>

	const HOST_JOINED_AT = new Date("2026-06-01T00:00:00.000Z")
	const CALLER_JOINED_AT = new Date("2026-06-01T00:01:00.000Z")

	beforeAll(async () => {
		process.env.JWT_SECRET = "unit-test-secret"
		process.env.JWT_ISSUER = "unit-test-issuer"

		const { default: challengeRoutes } = await import("./change-team")
		app = express()
		app.use(express.json())
		app.use("/api", challengeRoutes)
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
		const res = await request(app).post(PATH).send({ roomId: 100 })

		expect(res.status).toBe(401)
		expect(res.body).toMatchObject({
			success: false,
			message: "auth-middleware.messages.token-required",
			status_code: 401
		})
		expect(roomFindUniqueMock).not.toHaveBeenCalled()
	})

	it("returns 400 when roomId is not an integer", async () => {
		const accessToken = buildAccessToken(11, "session-challenge-1")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 11 }))

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({ roomId: "abc" })

		expect(res.status).toBe(400)
		expect(res.body).toMatchObject({
			success: false,
			message: "challenge.messages.invalid-room-id",
			status_code: 400
		})
		expect(roomFindUniqueMock).not.toHaveBeenCalled()
	})

	it("returns 400 when roomId is 0", async () => {
		const accessToken = buildAccessToken(11, "session-challenge-1b")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 11 }))

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({ roomId: 0 })

		expect(res.status).toBe(400)
		expect(res.body).toMatchObject({
			success: false,
			message: "challenge.messages.invalid-room-id",
			status_code: 400
		})
		expect(roomFindUniqueMock).not.toHaveBeenCalled()
	})

	it("returns 404 when room is not found", async () => {
		const accessToken = buildAccessToken(11, "session-challenge-2")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 11 }))
		roomFindUniqueMock.mockResolvedValue(null)

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({ roomId: 100 })

		expect(res.status).toBe(404)
		expect(res.body).toMatchObject({
			success: false,
			message: "challenge.messages.room-not-found",
			status_code: 404
		})
		expect(roomUserFindManyMock).not.toHaveBeenCalled()
	})

	it("returns 400 when room is not in waiting state", async () => {
		const accessToken = buildAccessToken(11, "session-challenge-3")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 11 }))
		roomFindUniqueMock.mockResolvedValue({ id: BigInt(100), status: 2 })

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({ roomId: 100 })

		expect(res.status).toBe(400)
		expect(res.body).toMatchObject({
			success: false,
			message: "challenge.messages.room-not-waiting",
			status_code: 400
		})
		expect(roomUserFindManyMock).not.toHaveBeenCalled()
	})

	it("returns 403 when caller is not in the room", async () => {
		const accessToken = buildAccessToken(11, "session-challenge-4")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 11 }))
		roomFindUniqueMock.mockResolvedValue({ id: BigInt(100), status: 1 })
		roomUserFindManyMock.mockResolvedValue([
			{
				user_id: BigInt(10),
				team: "red",
				joined_at: HOST_JOINED_AT,
				users: { id: BigInt(10), display_name: "Host", avatar_seq: 0, total_amount: 200 }
			},
			{
				user_id: BigInt(12),
				team: null,
				joined_at: CALLER_JOINED_AT,
				users: { id: BigInt(12), display_name: "Other", avatar_seq: 0, total_amount: 100 }
			}
		])

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({ roomId: 100 })

		expect(res.status).toBe(403)
		expect(res.body).toMatchObject({
			success: false,
			message: "challenge.messages.not-in-room",
			status_code: 403
		})
		expect(roomUserUpdateMock).not.toHaveBeenCalled()
	})

	it("returns 400 when caller is the host", async () => {
		const accessToken = buildAccessToken(11, "session-challenge-5")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 11 }))
		roomFindUniqueMock.mockResolvedValue({ id: BigInt(100), status: 1, host_id: BigInt(11) })
		// caller (11) is the room host
		roomUserFindManyMock.mockResolvedValue([
			{
				user_id: BigInt(11),
				team: "red",
				joined_at: HOST_JOINED_AT,
				users: { id: BigInt(11), display_name: "Caller", avatar_seq: 0, total_amount: 150 }
			},
			{
				user_id: BigInt(12),
				team: null,
				joined_at: CALLER_JOINED_AT,
				users: { id: BigInt(12), display_name: "Other", avatar_seq: 0, total_amount: 100 }
			}
		])

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({ roomId: 100, isLeaveToSeat: false })

		expect(res.status).toBe(400)
		expect(res.body).toMatchObject({
			success: false,
			message: "challenge.messages.caller-is-host",
			status_code: 400
		})
		expect(roomUserUpdateMock).not.toHaveBeenCalled()
	})

	it("returns 400 when host has no team", async () => {
		const accessToken = buildAccessToken(11, "session-challenge-6")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 11 }))
		roomFindUniqueMock.mockResolvedValue({ id: BigInt(100), status: 1, host_id: BigInt(10) })
		roomUserFindManyMock.mockResolvedValue([
			{
				user_id: BigInt(10),
				team: null,
				joined_at: HOST_JOINED_AT,
				users: { id: BigInt(10), display_name: "Host", avatar_seq: 0, total_amount: 200 }
			},
			{
				user_id: BigInt(11),
				team: null,
				joined_at: CALLER_JOINED_AT,
				users: { id: BigInt(11), display_name: "Caller", avatar_seq: 0, total_amount: 150 }
			}
		])

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({ roomId: 100, isLeaveToSeat: false })

		expect(res.status).toBe(400)
		expect(res.body).toMatchObject({
			success: false,
			message: "challenge.messages.host-has-no-team",
			status_code: 400
		})
		expect(roomUserUpdateMock).not.toHaveBeenCalled()
	})

	it("returns 400 when user cannot afford bet while challenging", async () => {
		const accessToken = buildAccessToken(11, "session-challenge-6b")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 11 }))
		// room has bet_amount=100, pve_mode=false (PvP)
		roomFindUniqueMock.mockResolvedValue({ id: BigInt(100), status: 1, host_id: BigInt(10), bet_amount: 100, pve_mode: false })
		roomUserFindManyMock.mockResolvedValue([
			{
				user_id: BigInt(10),
				team: "red",
				joined_at: HOST_JOINED_AT,
				users: { id: BigInt(10), display_name: "Host", avatar_seq: 0, total_amount: 200 }
			},
			{
				user_id: BigInt(11),
				team: null,
				joined_at: CALLER_JOINED_AT,
				users: { id: BigInt(11), display_name: "Caller", avatar_seq: 0, total_amount: 120 }
			}
		])
		// Caller has 120, bet=100 → 100*10 > 120*8 (1000 > 960) → cannot afford
		userFindUniqueMock.mockResolvedValue({ total_amount: 120 })

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({ roomId: 100, isLeaveToSeat: false })

		expect(res.status).toBe(400)
		expect(res.body).toMatchObject({
			success: false,
			message: "challenge.messages.insufficient-amount",
			status_code: 400
		})
		expect(roomUserUpdateMock).not.toHaveBeenCalled()
	})

	it("returns 200 when user can afford bet at exactly 80% threshold", async () => {
		const accessToken = buildAccessToken(11, "session-challenge-6c")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 11 }))
		// room has bet_amount=100, balance=125 → 100*10 <= 125*8 (1000 <= 1000) → at threshold
		roomFindUniqueMock.mockResolvedValue({ id: BigInt(100), status: 1, host_id: BigInt(10), bet_amount: 100, pve_mode: false })
		roomUserFindManyMock.mockResolvedValueOnce([
			{
				user_id: BigInt(10),
				team: "red",
				joined_at: HOST_JOINED_AT,
				users: { id: BigInt(10), display_name: "Host", avatar_seq: 0, total_amount: 200 }
			},
			{
				user_id: BigInt(11),
				team: null,
				joined_at: CALLER_JOINED_AT,
				users: { id: BigInt(11), display_name: "Caller", avatar_seq: 0, total_amount: 125 }
			}
		])

		userFindUniqueMock.mockResolvedValueOnce({ total_amount: 125 })
		roomUserUpdateMock.mockResolvedValueOnce({})

		roomUserFindManyMock.mockResolvedValueOnce([
			{
				team: "red",
				joined_at: HOST_JOINED_AT,
				users: { id: BigInt(10), display_name: "Host", avatar_seq: 0, total_amount: 200, is_bot: false }
			},
			{
				team: "black",
				joined_at: CALLER_JOINED_AT,
				users: { id: BigInt(11), display_name: "Caller", avatar_seq: 0, total_amount: 125, is_bot: false }
			}
		])

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({ roomId: 100, isLeaveToSeat: false })

		expect(res.status).toBe(200)
		expect(res.body).toMatchObject({
			success: true,
			message: "challenge.messages.success",
			status_code: 200
		})
		expect(roomUserUpdateMock).toHaveBeenCalled()
	})

	it("returns 200 and skips balance check when joining in PvE mode", async () => {
		const accessToken = buildAccessToken(11, "session-challenge-6d")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 11 }))
		// room has bet_amount=100, pve_mode=true → balance check should be skipped even though balance=50
		roomFindUniqueMock.mockResolvedValue({ id: BigInt(100), status: 1, host_id: BigInt(10), bet_amount: 100, pve_mode: true })
		roomUserFindManyMock.mockResolvedValueOnce([
			{
				user_id: BigInt(10),
				team: "red",
				joined_at: HOST_JOINED_AT,
				users: { id: BigInt(10), display_name: "Host", avatar_seq: 0, total_amount: 200 }
			},
			{
				user_id: BigInt(11),
				team: null,
				joined_at: CALLER_JOINED_AT,
				users: { id: BigInt(11), display_name: "Caller", avatar_seq: 0, total_amount: 50 }
			}
		])

		roomUserUpdateMock.mockResolvedValueOnce({})

		roomUserFindManyMock.mockResolvedValueOnce([
			{
				team: "red",
				joined_at: HOST_JOINED_AT,
				users: { id: BigInt(10), display_name: "Host", avatar_seq: 0, total_amount: 200, is_bot: false }
			},
			{
				team: "black",
				joined_at: CALLER_JOINED_AT,
				users: { id: BigInt(11), display_name: "Caller", avatar_seq: 0, total_amount: 50, is_bot: false }
			}
		])

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({ roomId: 100, isLeaveToSeat: false })

		expect(res.status).toBe(200)
		expect(res.body).toMatchObject({
			success: true,
			message: "challenge.messages.success",
			status_code: 200
		})
		// userFindUniqueMock should not be called for balance check in PvE mode
		expect(userFindUniqueMock).not.toHaveBeenCalled()
		expect(roomUserUpdateMock).toHaveBeenCalled()
	})

	it("returns 400 when both team seats are already taken", async () => {
		const accessToken = buildAccessToken(11, "session-challenge-7")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 11 }))
		roomFindUniqueMock.mockResolvedValue({ id: BigInt(100), status: 1, host_id: BigInt(10) })
		// host=10 has "red", user 12 has "black" → opposite seat occupied
		roomUserFindManyMock.mockResolvedValue([
			{
				user_id: BigInt(10),
				team: "red",
				joined_at: HOST_JOINED_AT,
				users: { id: BigInt(10), display_name: "Host", avatar_seq: 0, total_amount: 200 }
			},
			{
				user_id: BigInt(11),
				team: null,
				joined_at: CALLER_JOINED_AT,
				users: { id: BigInt(11), display_name: "Caller", avatar_seq: 0, total_amount: 150 }
			},
			{
				user_id: BigInt(12),
				team: "black",
				joined_at: new Date("2026-06-01T00:02:00.000Z"),
				users: { id: BigInt(12), display_name: "Opponent", avatar_seq: 0, total_amount: 180 }
			}
		])

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({ roomId: 100, isLeaveToSeat: false })

		expect(res.status).toBe(400)
		expect(res.body).toMatchObject({
			success: false,
			message: "challenge.messages.both-seats-taken",
			status_code: 400
		})
		expect(roomUserUpdateMock).not.toHaveBeenCalled()
	})

	it("returns 200 and updates caller to opposite team of host", async () => {
		const accessToken = buildAccessToken(11, "session-challenge-8")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 11 }))
		roomFindUniqueMock.mockResolvedValue({ id: BigInt(100), status: 1, host_id: BigInt(10), bet_amount: 50, pve_mode: false })

		// First findMany: validation pass — host=10 (red), caller=11 (no team)
		roomUserFindManyMock.mockResolvedValueOnce([
			{
				user_id: BigInt(10),
				team: "red",
				joined_at: HOST_JOINED_AT,
				users: { id: BigInt(10), display_name: "Host", avatar_seq: 0, total_amount: 200 }
			},
			{
				user_id: BigInt(11),
				team: null,
				joined_at: CALLER_JOINED_AT,
				users: { id: BigInt(11), display_name: "Caller", avatar_seq: 0, total_amount: 150 }
			}
		])

		// Balance check: bet_amount=50, user balance=150 → 50*10 <= 150*8 (500 <= 1200) → can afford
		userFindUniqueMock.mockResolvedValueOnce({ total_amount: 150 })

		roomUserUpdateMock.mockResolvedValueOnce({})

		// Second findMany: updated users — caller now has "black"
		roomUserFindManyMock.mockResolvedValueOnce([
			{
				team: "red",
				joined_at: HOST_JOINED_AT,
				users: { id: BigInt(10), display_name: "Host", avatar_seq: 0, total_amount: 200, is_bot: false }
			},
			{
				team: "black",
				joined_at: CALLER_JOINED_AT,
				users: { id: BigInt(11), display_name: "Caller", avatar_seq: 0, total_amount: 150, is_bot: false }
			}
		])

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({ roomId: 100, isLeaveToSeat: false })

		expect(res.status).toBe(200)
		expect(res.body).toMatchObject({
			success: true,
			message: "challenge.messages.success",
			status_code: 200
		})
		expect(roomUserUpdateMock).toHaveBeenCalledWith({
			where: {
				room_id_user_id: {
					room_id: BigInt(100),
					user_id: BigInt(11)
				}
			},
			data: { team: "black" }
		})
		expect(emitRoomUsersUpdatedMock).toHaveBeenCalledWith(100, [
			{
				id: 10,
				display_name: "Host",
				avatar_seq: 0,
				avatar_url: "/images/10.jpg",
				team: "red",
				total_amount: 200,
				is_bot: false,
				joined_at: HOST_JOINED_AT
			},
			{
				id: 11,
				display_name: "Caller",
				avatar_seq: 0,
				avatar_url: "/images/11.jpg",
				team: "black",
				total_amount: 150,
				is_bot: false,
				joined_at: CALLER_JOINED_AT
			}
		])
		expect(res.body.data).toEqual([
			expect.objectContaining({ id: 10, team: "red", is_bot: false, back_ready: null }),
			expect.objectContaining({ id: 11, team: "black", is_bot: false, back_ready: null })
		])
	})

	it("returns 200 and sets caller's team to null when isLeaveToSeat is true", async () => {
		const accessToken = buildAccessToken(11, "session-challenge-10")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 11 }))
		roomFindUniqueMock.mockResolvedValue({ id: BigInt(100), status: 1, host_id: BigInt(10) })

		// Caller (11) is currently on "black"
		roomUserFindManyMock.mockResolvedValueOnce([
			{
				user_id: BigInt(10),
				team: "red",
				joined_at: HOST_JOINED_AT,
				users: { id: BigInt(10), display_name: "Host", avatar_seq: 0, total_amount: 200 }
			},
			{
				user_id: BigInt(11),
				team: "black",
				joined_at: CALLER_JOINED_AT,
				users: { id: BigInt(11), display_name: "Caller", avatar_seq: 0, total_amount: 150 }
			}
		])

		roomUserUpdateMock.mockResolvedValueOnce({})

		// Second findMany: caller now has null team
		roomUserFindManyMock.mockResolvedValueOnce([
			{
				team: "red",
				joined_at: HOST_JOINED_AT,
				users: { id: BigInt(10), display_name: "Host", avatar_seq: 0, total_amount: 200, is_bot: false }
			},
			{
				team: null,
				joined_at: CALLER_JOINED_AT,
				users: { id: BigInt(11), display_name: "Caller", avatar_seq: 0, total_amount: 150, is_bot: false }
			}
		])

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({ roomId: 100, isLeaveToSeat: true })

		expect(res.status).toBe(200)
		expect(res.body).toMatchObject({
			success: true,
			message: "challenge.messages.success",
			status_code: 200
		})
		expect(roomUserUpdateMock).toHaveBeenCalledWith({
			where: {
				room_id_user_id: {
					room_id: BigInt(100),
					user_id: BigInt(11)
				}
			},
			data: { team: null }
		})
		expect(res.body.data).toEqual([
			expect.objectContaining({ id: 10, team: "red", is_bot: false, back_ready: null }),
			expect.objectContaining({ id: 11, team: null, is_bot: false, back_ready: null })
		])
	})

	it("returns 500 when an unexpected error happens", async () => {
		const accessToken = buildAccessToken(11, "session-challenge-9")
		consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined)
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 11 }))
		roomFindUniqueMock.mockRejectedValue(new Error("db down"))

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({ roomId: 100 })

		expect(res.status).toBe(500)
		expect(res.body).toMatchObject({
			success: false,
			message: "challenge.messages.internal-server-error",
			status_code: 500
		})
	})
})
