import express from "express"
import jwt from "jsonwebtoken"
import request from "supertest"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"

const redisGetMock = vi.fn()
const toArrayMock = vi.fn()
const sortMock = vi.fn()
const findMock = vi.fn()
const getGameHistoryCollectionMock = vi.fn()

const PATH = "/api/game/movement-history"

vi.mock("../../common/redis", () => ({
	default: {
		get: redisGetMock
	}
}))

vi.mock("../../common/mongodb", () => ({
	getGameHistoryCollection: getGameHistoryCollectionMock
}))

describe("GET /api/game/movement-history", () => {
	let app: express.Express
	let consoleErrorSpy: ReturnType<typeof vi.spyOn>

	beforeAll(async () => {
		process.env.JWT_SECRET = "unit-test-secret"
		process.env.JWT_ISSUER = "unit-test-issuer"

		const { default: getHistoryRoutes } = await import("./get-history")
		app = express()
		app.use(express.json())
		app.use("/api", getHistoryRoutes)
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
		const res = await request(app).get(`${PATH}?gameId=game-1`)

		expect(res.status).toBe(401)
		expect(res.body).toMatchObject({
			success: false,
			message: "auth-middleware.messages.token-required",
			status_code: 401
		})
	})

	it("returns 400 when gameId is missing", async () => {
		const accessToken = buildAccessToken(81, "session-history-1")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 81 }))

		const res = await request(app)
			.get(PATH)
			.set("Authorization", `Bearer ${accessToken}`)

		expect(res.status).toBe(400)
		expect(res.body).toMatchObject({
			success: false,
			message: "get-game-history.messages.invalid-game-id",
			status_code: 400
		})
		expect(getGameHistoryCollectionMock).not.toHaveBeenCalled()
	})

	it("returns 200 and game history list", async () => {
		const accessToken = buildAccessToken(81, "session-history-2")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 81 }))

		toArrayMock.mockResolvedValue([
			{
				_id: { toString: () => "mongo-id-1" },
				gameId: "game-1",
				move: "P7+1"
			},
			{
				_id: { toString: () => "mongo-id-2" },
				game_id: "game-1",
				move: "p3+1"
			}
		])
		sortMock.mockReturnValue({ toArray: toArrayMock })
		findMock.mockReturnValue({ sort: sortMock })
		getGameHistoryCollectionMock.mockResolvedValue({ find: findMock })

		const res = await request(app)
			.get(`${PATH}?gameId=game-1`)
			.set("Authorization", `Bearer ${accessToken}`)

		expect(res.status).toBe(200)
		expect(findMock).toHaveBeenCalledWith({
			$or: [{ gameId: "game-1" }, { game_id: "game-1" }]
		})
		expect(sortMock).toHaveBeenCalledWith({ time_stamp: 1 })
		expect(res.body).toMatchObject({
			success: true,
			message: "get-game-history.messages.success",
			status_code: 200,
			data: [
				{ _id: "mongo-id-1", gameId: "game-1", move: "P7+1" },
				{ _id: "mongo-id-2", game_id: "game-1", move: "p3+1" }
			]
		})
	})

	it("returns 500 when mongo query fails", async () => {
		const accessToken = buildAccessToken(81, "session-history-3")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 81 }))
		consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined)
		getGameHistoryCollectionMock.mockRejectedValue(new Error("mongo down"))

		const res = await request(app)
			.get(`${PATH}?gameId=game-1`)
			.set("Authorization", `Bearer ${accessToken}`)

		expect(res.status).toBe(500)
		expect(res.body).toMatchObject({
			success: false,
			message: "get-game-history.messages.internal-server-error",
			status_code: 500
		})
	})
})
