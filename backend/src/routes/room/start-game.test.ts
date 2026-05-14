import express from "express"
import jwt from "jsonwebtoken"
import request from "supertest"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"

const redisGetMock = vi.fn()
const transactionMock = vi.fn()
const roomUpdateMock = vi.fn()
const gameCreateMock = vi.fn()

const PATH = "/api/room/start"

vi.mock("../../common/redis", () => ({
	default: {
		get: redisGetMock
	}
}))

vi.mock("../../prisma", () => ({
	default: {
		$transaction: transactionMock
	}
}))

describe("POST /api/room/start", () => {
	let app: express.Express
	let consoleErrorSpy: ReturnType<typeof vi.spyOn>

	beforeAll(async () => {
		process.env.JWT_SECRET = "unit-test-secret"
		process.env.JWT_ISSUER = "unit-test-issuer"

		const { default: startGameRoutes } = await import("./start-game")
		app = express()
		app.use(express.json())
		app.use("/api", startGameRoutes)
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

	it("returns 400 when roomId is invalid", async () => {
		const accessToken = buildAccessToken(61, "session-start-1")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 61 }))

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({ id: "abc" })

		expect(res.status).toBe(400)
		expect(res.body).toMatchObject({
			success: false,
			message: "start-game.messages.invalid-room-id",
			status_code: 400
		})
		expect(transactionMock).not.toHaveBeenCalled()
	})

	it("returns 201 when game is started successfully", async () => {
		const accessToken = buildAccessToken(61, "session-start-2")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 61 }))

		roomUpdateMock.mockResolvedValue({
			id: BigInt(101),
			status: 2
		})
		gameCreateMock.mockResolvedValue({
			id: "c5afe4a6-48fd-47de-ac7e-1f635f859919",
			status: 0,
			room_id: BigInt(101)
		})
		transactionMock.mockImplementation(async callback =>
			callback({
				room: {
					update: roomUpdateMock
				},
				game: {
					create: gameCreateMock
				}
			})
		)

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({ id: 101 })

		expect(res.status).toBe(201)
		expect(res.body).toMatchObject({
			success: true,
			message: "start-game.messages.success",
			status_code: 201,
			data: {
				game: {
					id: "c5afe4a6-48fd-47de-ac7e-1f635f859919",
					status: 0,
					room_id: 101
				},
				room: {
					id: 101,
					status: 2
				}
			}
		})

		expect(roomUpdateMock).toHaveBeenCalledWith({
			where: { id: BigInt(101) },
			data: { status: 2 },
			select: {
				id: true,
				status: true
			}
		})
		expect(gameCreateMock).toHaveBeenCalledWith({
			data: {
				status: 0,
				room_id: BigInt(101)
			},
			select: {
				id: true,
				status: true,
				room_id: true
			}
		})
	})

	it("returns 404 when room is not found", async () => {
		const accessToken = buildAccessToken(61, "session-start-3")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 61 }))
		transactionMock.mockRejectedValue({ code: "P2025" })

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({ id: 999 })

		expect(res.status).toBe(404)
		expect(res.body).toMatchObject({
			success: false,
			message: "start-game.messages.room-not-found",
			status_code: 404
		})
	})

	it("returns 500 when unexpected error happens", async () => {
		const accessToken = buildAccessToken(61, "session-start-4")
		consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined)
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 61 }))
		transactionMock.mockRejectedValue(new Error("db down"))

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({ id: 101 })

		expect(res.status).toBe(500)
		expect(res.body).toMatchObject({
			success: false,
			message: "start-game.messages.internal-server-error",
			status_code: 500
		})
	})
})
