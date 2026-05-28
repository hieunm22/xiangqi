import express from "express"
import jwt from "jsonwebtoken"
import request from "supertest"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"

const redisGetMock = vi.fn()
const roomFindUniqueMock = vi.fn()
const roomUpdateMock = vi.fn()
const roomUserFindUniqueMock = vi.fn()
const roomUserDeleteManyMock = vi.fn()
const roomUserFindFirstMock = vi.fn()
const roomUserUpdateMock = vi.fn()
const roomUserCountMock = vi.fn()
const roomUserFindManyMock = vi.fn()
const gameFindFirstMock = vi.fn()
const gameUpdateMock = vi.fn()
const releaseEngineMock = vi.fn()
const emitRoomUsersUpdatedMock = vi.fn()
const emitRoomDeletedMock = vi.fn()

const PATH = "/api/room/leave"

vi.mock("../../common/redis", () => ({
	default: {
		get: redisGetMock
	}
}))

vi.mock("prisma", () => ({
	default: {
		room: {
			findUnique: roomFindUniqueMock,
			update: roomUpdateMock
		},
		roomUser: {
			findUnique: roomUserFindUniqueMock,
			deleteMany: roomUserDeleteManyMock,
			findFirst: roomUserFindFirstMock,
			update: roomUserUpdateMock,
			count: roomUserCountMock,
			findMany: roomUserFindManyMock
		},
		game: {
			findFirst: gameFindFirstMock,
			update: gameUpdateMock
		}
	}
}))

vi.mock("common/bot-engine", () => ({
	BOT_USER_ID: BigInt(0),
	engineManager: {
		releaseEngine: releaseEngineMock
	}
}))

vi.mock("common/socket", () => ({
	emitRoomUsersUpdated: emitRoomUsersUpdatedMock,
	emitRoomDeleted: emitRoomDeletedMock
}))

describe("DELETE /api/room/leave", () => {
	let app: express.Express
	let consoleErrorSpy: ReturnType<typeof vi.spyOn>

	beforeAll(async () => {
		process.env.JWT_SECRET = "unit-test-secret"
		process.env.JWT_ISSUER = "unit-test-issuer"

		const { default: leaveRoomRoutes } = await import("./leave-room")
		app = express()
		app.use(express.json())
		app.use("/api", leaveRoomRoutes)
	})

	afterEach(() => {
		vi.clearAllMocks()
		releaseEngineMock.mockResolvedValue(undefined)
		consoleErrorSpy?.mockRestore()
	})

	const buildAccessToken = (userId: number, sessionId: string) =>
		jwt.sign({ sub: userId, jti: sessionId }, process.env.JWT_SECRET as string, {
			issuer: process.env.JWT_ISSUER,
			expiresIn: "1h"
		})

	it("returns 401 when authorization token is missing", async () => {
		const res = await request(app).delete(PATH).send({ id: 101 })

		expect(res.status).toBe(401)
		expect(res.body).toMatchObject({
			success: false,
			message: "auth-middleware.messages.token-required",
			status_code: 401
		})
	})

	it("returns 400 when room id is invalid", async () => {
		const accessToken = buildAccessToken(51, "session-leave-1")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 51 }))

		const res = await request(app)
			.delete(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({ id: "abc" })

		expect(res.status).toBe(400)
		expect(res.body).toMatchObject({
			success: false,
			message: "leave-room.messages.invalid-room-id",
			status_code: 400
		})
		expect(roomUserDeleteManyMock).not.toHaveBeenCalled()
	})

	it("returns 404 when room does not exist", async () => {
		const accessToken = buildAccessToken(51, "session-leave-room-missing")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 51 }))
		roomFindUniqueMock.mockResolvedValue(null)

		const res = await request(app)
			.delete(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({ id: 101 })

		expect(res.status).toBe(404)
		expect(res.body).toMatchObject({
			success: false,
			message: "leave-room.messages.room-not-found",
			status_code: 404
		})
		expect(roomUserFindUniqueMock).not.toHaveBeenCalled()
	})

	it("returns 404 when player is not in room", async () => {
		const accessToken = buildAccessToken(51, "session-leave-2")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 51 }))
		roomFindUniqueMock.mockResolvedValue({ id: BigInt(101), pve_mode: false })
		roomUserFindUniqueMock.mockResolvedValue(null)

		const res = await request(app)
			.delete(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({ id: 101 })

		expect(res.status).toBe(404)
		expect(res.body).toMatchObject({
			success: false,
			message: "leave-room.messages.player-not-in-room",
			status_code: 404
		})
		expect(roomUserCountMock).not.toHaveBeenCalled()
		expect(roomUpdateMock).not.toHaveBeenCalled()
	})

	it("returns 200 and keeps room when players still remain", async () => {
		const accessToken = buildAccessToken(51, "session-leave-3")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 51 }))
		roomFindUniqueMock.mockResolvedValue({ id: BigInt(101), pve_mode: false })
		roomUserFindUniqueMock.mockResolvedValue({ team: null })
		roomUserDeleteManyMock.mockResolvedValue({ count: 1 })
		roomUserCountMock.mockResolvedValue(1)
		roomUserFindManyMock.mockResolvedValue([
			{
				joined_at: new Date("2026-05-26T00:00:00.000Z"),
				team: "red",
				users: {
					id: BigInt(88),
					display_name: "Room owner",
					avatar_seq: 0
				}
			}
		])

		const res = await request(app)
			.delete(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({ id: 101 })

		expect(res.status).toBe(200)
		expect(res.body).toMatchObject({
			success: true,
			message: "leave-room.messages.success",
			status_code: 200
		})
		expect(roomUserDeleteManyMock).toHaveBeenCalledWith({
			where: {
				room_id: BigInt(101),
				user_id: BigInt(51)
			}
		})
		expect(roomUpdateMock).not.toHaveBeenCalled()
		expect(emitRoomUsersUpdatedMock).toHaveBeenCalledWith(101, [
			{
				id: 88,
				display_name: "Room owner",
				avatar_seq: 0,
				avatar_url: "/images/88.jpg",
				team: "red",
				joined_at: new Date("2026-05-26T00:00:00.000Z")
			}
		])
	})

	it("promotes first audience to vacated team when a player leaves", async () => {
		const accessToken = buildAccessToken(51, "session-leave-3b")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 51 }))
		roomFindUniqueMock.mockResolvedValue({ id: BigInt(101), pve_mode: false })
		roomUserFindUniqueMock.mockResolvedValue({ team: "black" })
		roomUserDeleteManyMock.mockResolvedValue({ count: 1 })
		roomUserFindFirstMock.mockResolvedValue({
			room_id: BigInt(101),
			user_id: BigInt(77)
		})
		roomUserUpdateMock.mockResolvedValue({})
		roomUserCountMock.mockResolvedValue(2)
		roomUserFindManyMock.mockResolvedValue([])

		const res = await request(app)
			.delete(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({ id: 101 })

		expect(res.status).toBe(200)
		expect(roomUserUpdateMock).toHaveBeenCalledWith({
			where: {
				room_id_user_id: {
					room_id: BigInt(101),
					user_id: BigInt(77)
				}
			},
			data: { team: "black" }
		})
	})

	it("soft-deletes (is_active=false) room when no players remain in a PvP room", async () => {
		const accessToken = buildAccessToken(51, "session-leave-4")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 51 }))
		roomFindUniqueMock.mockResolvedValue({ id: BigInt(101), pve_mode: false })
		roomUserFindUniqueMock.mockResolvedValue({ team: "red" })
		roomUserDeleteManyMock.mockResolvedValue({ count: 1 })
		roomUserFindFirstMock.mockResolvedValue(null)
		roomUserCountMock.mockResolvedValue(0)
		roomUpdateMock.mockResolvedValue({ id: BigInt(101), is_active: false })

		const res = await request(app)
			.delete(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({ id: 101 })

		expect(res.status).toBe(200)
		expect(roomUpdateMock).toHaveBeenCalledWith({
			where: { id: BigInt(101) },
			data: { is_active: false }
		})
		expect(emitRoomUsersUpdatedMock).not.toHaveBeenCalled()
		expect(emitRoomDeletedMock).toHaveBeenCalledWith(101)
	})

	it("on PvE leave: kicks bot, ends active game with bot as winner, deactivates room", async () => {
		const accessToken = buildAccessToken(51, "session-leave-pve")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 51 }))
		roomFindUniqueMock.mockResolvedValue({ id: BigInt(101), pve_mode: true })
		roomUserFindUniqueMock.mockResolvedValue({ team: "red" })
		roomUserDeleteManyMock.mockResolvedValue({ count: 2 })
		gameFindFirstMock.mockResolvedValue({ id: "game-uuid-1" })
		gameUpdateMock.mockResolvedValue({})
		roomUpdateMock.mockResolvedValue({ id: BigInt(101), is_active: false })

		const res = await request(app)
			.delete(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({ id: 101 })

		expect(res.status).toBe(200)
		expect(roomUserDeleteManyMock).toHaveBeenCalledWith({
			where: {
				room_id: BigInt(101),
				user_id: { in: [BigInt(51), BigInt(0)] }
			}
		})
		expect(gameFindFirstMock).toHaveBeenCalledWith({
			where: { room_id: BigInt(101), status: 1 },
			select: { id: true }
		})
		expect(gameUpdateMock).toHaveBeenCalledWith({
			where: { id: "game-uuid-1" },
			data: { winner_id: BigInt(0), status: 2 }
		})
		expect(roomUpdateMock).toHaveBeenCalledWith({
			where: { id: BigInt(101) },
			data: { is_active: false }
		})
		expect(releaseEngineMock).toHaveBeenCalledWith("game-uuid-1")
		expect(emitRoomDeletedMock).toHaveBeenCalledWith(101)
		expect(roomUserFindFirstMock).not.toHaveBeenCalled()
		expect(roomUserCountMock).not.toHaveBeenCalled()
	})

	it("on PvE leave: still deactivates room when no active game exists", async () => {
		const accessToken = buildAccessToken(51, "session-leave-pve-nogame")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 51 }))
		roomFindUniqueMock.mockResolvedValue({ id: BigInt(101), pve_mode: true })
		roomUserFindUniqueMock.mockResolvedValue({ team: "red" })
		roomUserDeleteManyMock.mockResolvedValue({ count: 2 })
		gameFindFirstMock.mockResolvedValue(null)
		roomUpdateMock.mockResolvedValue({ id: BigInt(101), is_active: false })

		const res = await request(app)
			.delete(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({ id: 101 })

		expect(res.status).toBe(200)
		expect(gameUpdateMock).not.toHaveBeenCalled()
		expect(releaseEngineMock).not.toHaveBeenCalled()
		expect(roomUpdateMock).toHaveBeenCalledWith({
			where: { id: BigInt(101) },
			data: { is_active: false }
		})
	})

	it("returns 500 when unexpected error happens", async () => {
		const accessToken = buildAccessToken(51, "session-leave-5")
		consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined)
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 51 }))
		roomFindUniqueMock.mockRejectedValue(new Error("db down"))

		const res = await request(app)
			.delete(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({ id: 101 })

		expect(res.status).toBe(500)
		expect(res.body).toMatchObject({
			success: false,
			message: "leave-room.messages.internal-server-error",
			status_code: 500
		})
	})
})
