import express from "express"
import jwt from "jsonwebtoken"
import request from "supertest"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"

const redisGetMock = vi.fn()
const roomUserFindUniqueMock = vi.fn()
const roomUserDeleteManyMock = vi.fn()
const roomUserFindFirstMock = vi.fn()
const roomUserUpdateMock = vi.fn()
const roomUserCountMock = vi.fn()
const roomUserFindManyMock = vi.fn()
const roomDeleteMock = vi.fn()
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
		roomUser: {
			findUnique: roomUserFindUniqueMock,
			deleteMany: roomUserDeleteManyMock,
			findFirst: roomUserFindFirstMock,
			update: roomUserUpdateMock,
			count: roomUserCountMock,
			findMany: roomUserFindManyMock
		},
		room: {
			delete: roomDeleteMock
		}
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

	it("returns 404 when player is not in room", async () => {
		const accessToken = buildAccessToken(51, "session-leave-2")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 51 }))
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
		expect(roomUserFindUniqueMock).toHaveBeenCalled()
		expect(roomUserCountMock).not.toHaveBeenCalled()
		expect(roomDeleteMock).not.toHaveBeenCalled()
	})

	it("returns 200 and keeps room when players still remain", async () => {
		const accessToken = buildAccessToken(51, "session-leave-3")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 51 }))
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
		expect(roomUserCountMock).toHaveBeenCalledWith({
			where: {
				room_id: BigInt(101)
			}
		})
		expect(roomDeleteMock).not.toHaveBeenCalled()
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
		roomUserFindUniqueMock.mockResolvedValue({ team: "black" })
		roomUserDeleteManyMock.mockResolvedValue({ count: 1 })
		roomUserFindFirstMock.mockResolvedValue({
			room_id: BigInt(101),
			user_id: BigInt(77)
		})
		roomUserUpdateMock.mockResolvedValue({})
		roomUserCountMock.mockResolvedValue(2)
		roomUserFindManyMock.mockResolvedValue([
			{
				joined_at: new Date("2026-05-26T00:00:00.000Z"),
				team: "red",
				users: {
					id: BigInt(88),
					display_name: "Owner",
					avatar_seq: 0
				}
			},
			{
				joined_at: new Date("2026-05-26T00:01:00.000Z"),
				team: "black",
				users: {
					id: BigInt(77),
					display_name: "Audience promoted",
					avatar_seq: 1
				}
			}
		])

		const res = await request(app)
			.delete(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({ id: 101 })

		expect(res.status).toBe(200)
		expect(roomUserFindFirstMock).toHaveBeenCalledWith({
			where: {
				room_id: BigInt(101),
				team: null
			},
			orderBy: {
				joined_at: "asc"
			},
			select: {
				room_id: true,
				user_id: true
			}
		})
		expect(roomUserUpdateMock).toHaveBeenCalledWith({
			where: {
				room_id_user_id: {
					room_id: BigInt(101),
					user_id: BigInt(77)
				}
			},
			data: {
				team: "black"
			}
		})
	})

	it("returns 200 and deletes room when no players remain", async () => {
		const accessToken = buildAccessToken(51, "session-leave-4")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 51 }))
		roomUserFindUniqueMock.mockResolvedValue({ team: "red" })
		roomUserDeleteManyMock.mockResolvedValue({ count: 1 })
		roomUserFindFirstMock.mockResolvedValue(null)
		roomUserCountMock.mockResolvedValue(0)
		roomDeleteMock.mockResolvedValue({ id: BigInt(101) })

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
		expect(roomDeleteMock).toHaveBeenCalledWith({
			where: {
				id: BigInt(101)
			}
		})
		expect(emitRoomUsersUpdatedMock).not.toHaveBeenCalled()
		expect(emitRoomDeletedMock).toHaveBeenCalledWith(101)
	})

	it("returns 500 when unexpected error happens", async () => {
		const accessToken = buildAccessToken(51, "session-leave-5")
		consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined)
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 51 }))
		roomUserFindUniqueMock.mockRejectedValue(new Error("db down"))

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