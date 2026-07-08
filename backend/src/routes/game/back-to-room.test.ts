import express from "express"
import jwt from "jsonwebtoken"
import request from "supertest"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"

const redisGetMock = vi.fn()
const roomUserFindUniqueMock = vi.fn()
const emitRoomUsersSnapshotMock = vi.fn()
const markPostGameReadyMock = vi.fn()

const PATH = "/api/game/back-to-room"

vi.mock("../../common/redis", () => ({
	default: {
		get: redisGetMock
	}
}))

vi.mock("prisma", () => ({
	default: {
		roomUser: {
			findUnique: roomUserFindUniqueMock
		}
	}
}))

vi.mock("common/game/post-game.helper", () => ({
	emitRoomUsersSnapshot: emitRoomUsersSnapshotMock,
	markPostGameReady: markPostGameReadyMock
}))

describe("POST /api/game/back-to-room", () => {
	let app: express.Express

	beforeAll(async () => {
		process.env.JWT_SECRET = "unit-test-secret"
		process.env.JWT_ISSUER = "unit-test-issuer"

		const { default: backToRoomRoutes } = await import("./back-to-room")
		app = express()
		app.use(express.json())
		app.use("/api", backToRoomRoutes)
	})

	afterEach(() => {
		vi.clearAllMocks()
	})

	const buildAccessToken = (userId: number, sessionId: string) =>
		jwt.sign({ sub: userId, jti: sessionId }, process.env.JWT_SECRET as string, {
			issuer: process.env.JWT_ISSUER,
			expiresIn: "1h"
		})

	it("returns 401 when authorization token is missing", async () => {
		const res = await request(app).post(PATH).send({ roomId: 100, gameId: "game-1" })

		expect(res.status).toBe(401)
		expect(res.body).toMatchObject({
			success: false,
			message: "auth-middleware.messages.token-required",
			status_code: 401
		})
	})

	it("returns 400 when roomId is invalid", async () => {
		const accessToken = buildAccessToken(11, "session-back-room-1")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 11 }))

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({ roomId: "abc", gameId: "game-1" })

		expect(res.status).toBe(400)
		expect(res.body).toMatchObject({
			success: false,
			message: "back-to-room.messages.invalid-room-id",
			status_code: 400
		})
	})

	it("returns 403 when user is not in room", async () => {
		const accessToken = buildAccessToken(11, "session-back-room-2")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 11 }))
		roomUserFindUniqueMock.mockResolvedValue(null)

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({ roomId: 100, gameId: "game-1" })

		expect(res.status).toBe(403)
		expect(res.body).toMatchObject({
			success: false,
			message: "back-to-room.messages.not-in-room",
			status_code: 403
		})
		expect(markPostGameReadyMock).not.toHaveBeenCalled()
	})

	it("returns 400 when caller is currently a spectator", async () => {
		const accessToken = buildAccessToken(11, "session-back-room-3")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 11 }))
		roomUserFindUniqueMock.mockResolvedValue({ team: null })

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({ roomId: 100, gameId: "game-1" })

		expect(res.status).toBe(400)
		expect(res.body).toMatchObject({
			success: false,
			message: "back-to-room.messages.spectator-cannot-back",
			status_code: 400
		})
		expect(markPostGameReadyMock).not.toHaveBeenCalled()
	})

	it("returns 200 and broadcasts updated room users when back confirmation succeeds", async () => {
		const accessToken = buildAccessToken(11, "session-back-room-4")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 11 }))
		roomUserFindUniqueMock.mockResolvedValue({ team: "red" })
		markPostGameReadyMock.mockReturnValue(true)
		emitRoomUsersSnapshotMock.mockResolvedValue(undefined)

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({ roomId: 100, gameId: "game-1" })

		expect(res.status).toBe(200)
		expect(markPostGameReadyMock).toHaveBeenCalledWith({
			roomId: 100,
			gameId: "game-1",
			userId: 11
		})
		expect(emitRoomUsersSnapshotMock).toHaveBeenCalledWith(100n)
		expect(res.body).toMatchObject({
			success: true,
			message: "back-to-room.messages.success",
			status_code: 200
		})
	})
})
