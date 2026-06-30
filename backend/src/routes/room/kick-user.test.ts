import express from "express"
import jwt from "jsonwebtoken"
import request from "supertest"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"

const redisGetMock = vi.fn()
const roomFindUniqueMock = vi.fn()
const roomUserFindFirstMock = vi.fn()
const roomUserFindUniqueMock = vi.fn()
const roomUserDeleteMock = vi.fn()
const roomUserUpdateMock = vi.fn()
const roomUserFindManyMock = vi.fn()
const emitRoomUsersUpdatedMock = vi.fn()
const emitUserKickedMock = vi.fn()

const PATH = "/api/room/kick"

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
			findFirst: roomUserFindFirstMock,
			findUnique: roomUserFindUniqueMock,
			delete: roomUserDeleteMock,
			update: roomUserUpdateMock,
			findMany: roomUserFindManyMock
		}
	}
}))

vi.mock("common/socket", () => ({
	emitRoomUsersUpdated: emitRoomUsersUpdatedMock,
	emitUserKicked: emitUserKickedMock
}))

describe("POST /api/room/kick", () => {
	let app: express.Express
	let consoleErrorSpy: ReturnType<typeof vi.spyOn>

	beforeAll(async () => {
		process.env.JWT_SECRET = "unit-test-secret"
		process.env.JWT_ISSUER = "unit-test-issuer"

		const { default: kickUserRoutes } = await import("./kick-user")
		app = express()
		app.use(express.json())
		app.use("/api", kickUserRoutes)
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
		const res = await request(app).post(PATH).send({ id: 101, userId: 22 })

		expect(res.status).toBe(401)
		expect(res.body).toMatchObject({
			success: false,
			message: "auth-middleware.messages.token-required",
			status_code: 401
		})
	})

	it("returns 400 when room id is invalid", async () => {
		const accessToken = buildAccessToken(11, "session-kick-1")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 11 }))

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({ id: "abc", userId: 22 })

		expect(res.status).toBe(400)
		expect(res.body).toMatchObject({
			success: false,
			message: "kick-user.messages.invalid-room-id",
			status_code: 400
		})
		expect(roomFindUniqueMock).not.toHaveBeenCalled()
	})

	it("returns 400 when room id is less than or equal to 0", async () => {
		const accessToken = buildAccessToken(11, "session-kick-1b")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 11 }))

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({ id: 0, userId: 22 })

		expect(res.status).toBe(400)
		expect(res.body).toMatchObject({
			success: false,
			message: "kick-user.messages.invalid-room-id",
			status_code: 400
		})
	})

	it("returns 400 when target userId is invalid", async () => {
		const accessToken = buildAccessToken(11, "session-kick-2")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 11 }))

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({ id: 101, userId: "abc" })

		expect(res.status).toBe(400)
		expect(res.body).toMatchObject({
			success: false,
			message: "kick-user.messages.invalid-user-id",
			status_code: 400
		})
		expect(roomFindUniqueMock).not.toHaveBeenCalled()
	})

	it("returns 400 when target userId is less than or equal to 0", async () => {
		const accessToken = buildAccessToken(11, "session-kick-2b")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 11 }))

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({ id: 101, userId: 0 })

		expect(res.status).toBe(400)
		expect(res.body).toMatchObject({
			success: false,
			message: "kick-user.messages.invalid-user-id",
			status_code: 400
		})
	})

	it("returns 400 when trying to kick yourself", async () => {
		const accessToken = buildAccessToken(11, "session-kick-self")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 11 }))

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({ id: 101, userId: 11 })

		expect(res.status).toBe(400)
		expect(res.body).toMatchObject({
			success: false,
			message: "kick-user.messages.cannot-kick-self",
			status_code: 400
		})
		expect(roomFindUniqueMock).not.toHaveBeenCalled()
	})

	it("returns 404 when room does not exist", async () => {
		const accessToken = buildAccessToken(11, "session-kick-3")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 11 }))
		roomFindUniqueMock.mockResolvedValue(null)

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({ id: 999, userId: 22 })

		expect(res.status).toBe(404)
		expect(res.body).toMatchObject({
			success: false,
			message: "kick-user.messages.room-not-found",
			status_code: 404
		})
		expect(roomFindUniqueMock).toHaveBeenCalledWith({
			where: { id: BigInt(999) },
			select: { id: true, status: true, host_id: true }
		})
	})

	it("returns 403 when requester is not the room host", async () => {
		const accessToken = buildAccessToken(11, "session-kick-4")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 11 }))
		roomFindUniqueMock.mockResolvedValue({ id: BigInt(101), status: 1, host_id: BigInt(99) })

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({ id: 101, userId: 22 })

		expect(res.status).toBe(403)
		expect(res.body).toMatchObject({
			success: false,
			message: "kick-user.messages.forbidden",
			status_code: 403
		})
		expect(roomUserDeleteMock).not.toHaveBeenCalled()
	})

	it("returns 403 when room has no host (edge case)", async () => {
		const accessToken = buildAccessToken(11, "session-kick-4b")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 11 }))
		roomFindUniqueMock.mockResolvedValue({ id: BigInt(101), status: 1, host_id: null })

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({ id: 101, userId: 22 })

		expect(res.status).toBe(403)
		expect(res.body).toMatchObject({
			success: false,
			message: "kick-user.messages.forbidden",
			status_code: 403
		})
	})

	it("returns 400 when room is not in waiting status", async () => {
		const accessToken = buildAccessToken(11, "session-kick-5")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 11 }))
		roomFindUniqueMock.mockResolvedValue({ id: BigInt(101), status: 2, host_id: BigInt(11) })

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({ id: 101, userId: 22 })

		expect(res.status).toBe(400)
		expect(res.body).toMatchObject({
			success: false,
			message: "kick-user.messages.room-not-waiting",
			status_code: 400
		})
		expect(roomUserFindUniqueMock).not.toHaveBeenCalled()
		expect(roomUserDeleteMock).not.toHaveBeenCalled()
	})

	it("returns 404 when target user is not in the room", async () => {
		const accessToken = buildAccessToken(11, "session-kick-6")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 11 }))
		roomFindUniqueMock.mockResolvedValue({ id: BigInt(101), status: 1, host_id: BigInt(11) })
		roomUserFindUniqueMock.mockResolvedValue(null)

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({ id: 101, userId: 22 })

		expect(res.status).toBe(404)
		expect(res.body).toMatchObject({
			success: false,
			message: "kick-user.messages.user-not-in-room",
			status_code: 404
		})
		expect(roomUserDeleteMock).not.toHaveBeenCalled()
	})

	it("returns 200 and kicks a spectator (no team) when requester is host", async () => {
		const accessToken = buildAccessToken(11, "session-kick-7")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 11 }))
		roomFindUniqueMock.mockResolvedValueOnce({ id: BigInt(101), status: 1, host_id: BigInt(11) })
		roomUserFindUniqueMock.mockResolvedValueOnce({ team: null })
		roomUserDeleteMock.mockResolvedValueOnce({})
		roomUserFindManyMock.mockResolvedValueOnce([
			{
				joined_at: new Date("2026-05-26T00:00:00.000Z"),
				team: "red",
				users: {
					id: BigInt(11),
					display_name: "Host",
					avatar_seq: 0,
					is_bot: false
				}
			}
		])

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({ id: 101, userId: 22 })

		expect(res.status).toBe(200)
		expect(res.body).toMatchObject({
			success: true,
			message: "kick-user.messages.success",
			status_code: 200
		})
		expect(roomUserDeleteMock).toHaveBeenCalledWith({
			where: {
				room_id_user_id: {
					room_id: BigInt(101),
					user_id: BigInt(22)
				}
			}
		})
		// Spectator had no team → no audience promotion
		expect(roomUserUpdateMock).not.toHaveBeenCalled()
		expect(emitUserKickedMock).toHaveBeenCalledWith(101, 22)
		expect(emitRoomUsersUpdatedMock).toHaveBeenCalledWith(101, [
			{
				id: 11,
				display_name: "Host",
				avatar_seq: 0,
				avatar_url: "/images/11.jpg",
				team: "red",
				is_bot: false,
				joined_at: new Date("2026-05-26T00:00:00.000Z")
			}
		])
	})

	it("does not promote audience when a player with team is kicked", async () => {
		const accessToken = buildAccessToken(11, "session-kick-8")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 11 }))
		roomFindUniqueMock.mockResolvedValue({ id: BigInt(101), status: 1, host_id: BigInt(11) })
		roomUserFindUniqueMock.mockResolvedValue({ team: "black" })
		roomUserDeleteMock.mockResolvedValue({})
		roomUserFindManyMock.mockResolvedValue([])

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({ id: 101, userId: 22 })

		expect(res.status).toBe(200)
		expect(roomUserUpdateMock).not.toHaveBeenCalled()
		expect(emitUserKickedMock).toHaveBeenCalledWith(101, 22)
	})



	it("returns 500 when an unexpected error happens", async () => {
		const accessToken = buildAccessToken(11, "session-kick-9")
		consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined)
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 11 }))
		roomFindUniqueMock.mockRejectedValue(new Error("db down"))

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({ id: 101, userId: 22 })

		expect(res.status).toBe(500)
		expect(res.body).toMatchObject({
			success: false,
			message: "kick-user.messages.internal-server-error",
			status_code: 500
		})
		expect(consoleErrorSpy).toHaveBeenCalledWith("[kick-user] Error:", expect.any(Error))
	})

	it("converts large room id correctly", async () => {
		const accessToken = buildAccessToken(11, "session-kick-10")
		const largeId = 9007199254740991 // Max safe integer
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 11 }))
		roomFindUniqueMock.mockResolvedValue({ id: BigInt(largeId), status: 1, host_id: BigInt(11) })
		roomUserFindUniqueMock.mockResolvedValue({ team: null })
		roomUserDeleteMock.mockResolvedValue({})
		roomUserFindManyMock.mockResolvedValue([])

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({ id: largeId, userId: 22 })

		expect(res.status).toBe(200)
		expect(roomFindUniqueMock).toHaveBeenCalledWith({
			where: { id: BigInt(largeId) },
			select: { id: true, status: true, host_id: true }
		})
	})
})
