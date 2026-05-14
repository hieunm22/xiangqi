import express from "express"
import jwt from "jsonwebtoken"
import request from "supertest"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import { RoomStatus } from "../../types/room.type"

const redisGetMock = vi.fn()
const roomUpdateMock = vi.fn()

const PATH = "/api/room/status"

vi.mock("../../common/redis", () => ({
	default: {
		get: redisGetMock
	}
}))

vi.mock("../../prisma", () => ({
	default: {
		room: {
			update: roomUpdateMock
		}
	}
}))

describe("PATCH/PUT /api/room/status", () => {
	let app: express.Express
	let consoleErrorSpy: ReturnType<typeof vi.spyOn>

	beforeAll(async () => {
		process.env.JWT_SECRET = "unit-test-secret"
		process.env.JWT_ISSUER = "unit-test-issuer"

		const { default: setRoomStatusRoutes } = await import("./set-room-status")
		app = express()
		app.use(express.json())
		app.use("/api", setRoomStatusRoutes)
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
		const res = await request(app).patch(PATH).send({ id: 101, status: RoomStatus.Waiting })

		expect(res.status).toBe(401)
		expect(res.body).toMatchObject({
			success: false,
			message: "auth-middleware.messages.token-required",
			status_code: 401
		})
	})

	it("returns 400 when id is invalid", async () => {
		const accessToken = buildAccessToken(61, "session-status-1")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 61 }))

		const res = await request(app)
			.patch(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({ id: "abc", status: RoomStatus.Waiting })

		expect(res.status).toBe(400)
		expect(res.body).toMatchObject({
			success: false,
			message: "set-room-status.messages.invalid-room-id",
			status_code: 400
		})
		expect(roomUpdateMock).not.toHaveBeenCalled()
	})

	it("returns 400 when status is not 1 or 2", async () => {
		const accessToken = buildAccessToken(61, "session-status-2")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 61 }))

		const res = await request(app)
			.patch(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({ id: 101, status: 3 })

		expect(res.status).toBe(400)
		expect(res.body).toMatchObject({
			success: false,
			message: "set-room-status.messages.invalid-status",
			status_code: 400
		})
		expect(roomUpdateMock).not.toHaveBeenCalled()
	})

	it("returns 200 when setting status 1 (waiting) via PATCH", async () => {
		const accessToken = buildAccessToken(61, "session-status-3")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 61 }))
		roomUpdateMock.mockResolvedValue({
			id: BigInt(101),
			name: "Room Waiting",
			status: RoomStatus.Waiting,
			red_first: true,
			bet_amount: 50,
			created_at: new Date("2026-05-12T00:00:00.000Z"),
			updated_at: new Date("2026-05-12T00:00:00.000Z")
		})

		const res = await request(app)
			.patch(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({ id: 101, status: RoomStatus.Waiting })

		expect(res.status).toBe(200)
		expect(res.body).toMatchObject({
			success: true,
			message: "set-room-status.messages.success",
			status_code: 200,
			room: {
				id: 101,
				name: "Room Waiting",
				status: RoomStatus.Waiting,
				red_first: true,
				bet_amount: 50
			}
		})
		expect(roomUpdateMock).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { id: BigInt(101) },
				data: { status: RoomStatus.Waiting }
			})
		)
	})

	it("returns 200 when setting status 2 (playing) via PUT", async () => {
		const accessToken = buildAccessToken(61, "session-status-4")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 61 }))
		roomUpdateMock.mockResolvedValue({
			id: BigInt(101),
			name: "Room Playing",
			status: RoomStatus.Playing,
			red_first: false,
			bet_amount: 100,
			created_at: new Date("2026-05-12T00:00:00.000Z"),
			updated_at: new Date("2026-05-12T00:00:00.000Z")
		})

		const res = await request(app)
			.put(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({ id: 101, status: RoomStatus.Playing })

		expect(res.status).toBe(200)
		expect(res.body).toMatchObject({
			success: true,
			message: "set-room-status.messages.success",
			status_code: 200,
			room: {
				id: 101,
				name: "Room Playing",
				status: RoomStatus.Playing,
				red_first: false,
				bet_amount: 100
			}
		})
		expect(roomUpdateMock).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { id: BigInt(101) },
				data: { status: RoomStatus.Playing }
			})
		)
	})

	it("returns 404 when room is not found (P2025)", async () => {
		const accessToken = buildAccessToken(61, "session-status-5")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 61 }))
		roomUpdateMock.mockRejectedValue({ code: "P2025" })

		const res = await request(app)
			.patch(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({ id: 999, status: RoomStatus.Waiting })

		expect(res.status).toBe(404)
		expect(res.body).toMatchObject({
			success: false,
			message: "set-room-status.messages.room-not-found",
			status_code: 404
		})
	})

	it("returns 500 when unexpected error happens", async () => {
		const accessToken = buildAccessToken(61, "session-status-6")
		consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined)
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 61 }))
		roomUpdateMock.mockRejectedValue(new Error("db down"))

		const res = await request(app)
			.patch(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({ id: 101, status: RoomStatus.Waiting })

		expect(res.status).toBe(500)
		expect(res.body).toMatchObject({
			success: false,
			message: "set-room-status.messages.internal-server-error",
			status_code: 500
		})
	})
})