import express from "express"
import jwt from "jsonwebtoken"
import request from "supertest"
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

const redisGetMock = vi.fn()
const gameFindUniqueMock = vi.fn()
const gameUpdateMock = vi.fn()
const roomUpdateMock = vi.fn()
const roomFindUniqueMock = vi.fn()
const transactionMock = vi.fn()
const roomUserFindManyMock = vi.fn()
const toArrayMock = vi.fn()
const limitMock = vi.fn()
const sortMock = vi.fn()
const findMock = vi.fn()
const insertOneMock = vi.fn()
const getGameHistoryCollectionMock = vi.fn()
const runEndGameTransactionMock = vi.fn()
const activatePostGameLockMock = vi.fn()
const syncPlayersPresenceMock = vi.fn()
const stopClockMock = vi.fn()

const PATH = "/api/game/draw-game"

vi.mock("../../common/redis", () => ({
	default: {
		get: redisGetMock
	}
}))

vi.mock("prisma", () => ({
	default: {
		$transaction: transactionMock,
		game: {
			findUnique: gameFindUniqueMock,
			update: gameUpdateMock
		},
		room: {
			findUnique: roomFindUniqueMock,
			update: roomUpdateMock
		},
		roomUser: {
			findMany: roomUserFindManyMock
		}
	}
}))

vi.mock("../../common/mongodb", () => ({
	getGameHistoryCollection: getGameHistoryCollectionMock
}))

vi.mock("../../common/game/end-game.helper", () => ({
	runEndGameTransaction: runEndGameTransactionMock
}))

vi.mock("../../common/game/post-game.helper", () => ({
	activatePostGameLock: activatePostGameLockMock
}))

vi.mock("../../common/game/presence-sync", () => ({
	syncPlayersPresence: syncPlayersPresenceMock
}))

vi.mock("../../common/game/game-clock", () => ({
	stopClock: stopClockMock
}))

describe("POST /api/game/draw-game", () => {
	let app: express.Express
	let consoleErrorSpy: ReturnType<typeof vi.spyOn>

	beforeAll(async () => {
		process.env.JWT_SECRET = "unit-test-secret"
		process.env.JWT_ISSUER = "unit-test-issuer"

		const { default: drawGameRoutes } = await import("./draw-game")
		app = express()
		app.use(express.json())
		app.use("/api", drawGameRoutes)
	})

	beforeEach(() => {
		findMock.mockReturnValue({ sort: sortMock })
		sortMock.mockReturnValue({ limit: limitMock })
		limitMock.mockReturnValue({ toArray: toArrayMock })
		getGameHistoryCollectionMock.mockResolvedValue({
			find: findMock,
			insertOne: insertOneMock
		})
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
		const res = await request(app).post(PATH).send({ gameId: "game-1" })

		expect(res.status).toBe(401)
		expect(res.body).toMatchObject({
			success: false,
			message: "auth-middleware.messages.token-required",
			status_code: 401
		})
	})

	it("returns 400 when gameId is invalid", async () => {
		const accessToken = buildAccessToken(11, "session-draw-1")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 11 }))

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({ gameId: 123 })

		expect(res.status).toBe(400)
		expect(res.body).toMatchObject({
			success: false,
			message: "draw-game.messages.invalid-game-id",
			status_code: 400
		})
		expect(gameFindUniqueMock).not.toHaveBeenCalled()
	})

	it("returns 404 when game is not found", async () => {
		const accessToken = buildAccessToken(11, "session-draw-2")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 11 }))
		gameFindUniqueMock.mockResolvedValue(null)

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({ gameId: "game-1" })

		expect(res.status).toBe(404)
		expect(res.body).toMatchObject({
			success: false,
			message: "draw-game.messages.game-not-found",
			status_code: 404
		})
		expect(roomUserFindManyMock).not.toHaveBeenCalled()
	})

	it("returns 403 when user is not in room", async () => {
		const accessToken = buildAccessToken(11, "session-draw-3")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 11 }))
		gameFindUniqueMock.mockResolvedValue({
			id: "game-1",
			room_id: BigInt(100),
			status: 1
		})
		roomUserFindManyMock.mockResolvedValue([
			{ user_id: BigInt(12), team: "red" },
			{ user_id: BigInt(13), team: "black" }
		])

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({ gameId: "game-1" })

		expect(res.status).toBe(403)
		expect(roomUserFindManyMock).toHaveBeenCalledWith({
			where: {
				room_id: BigInt(100)
			},
			orderBy: {
				joined_at: "asc"
			},
			select: {
				user_id: true,
				team: true
			}
		})
		expect(res.body).toMatchObject({
			success: false,
			message: "draw-game.messages.forbidden",
			status_code: 403
		})
		expect(gameUpdateMock).not.toHaveBeenCalled()
	})

	it("returns 403 when user is audience with team null", async () => {
		const accessToken = buildAccessToken(11, "session-draw-3b")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 11 }))
		gameFindUniqueMock.mockResolvedValue({
			id: "game-1",
			room_id: BigInt(100),
			status: 1
		})
		roomUserFindManyMock.mockResolvedValue([
			{ user_id: BigInt(11), team: null },
			{ user_id: BigInt(12), team: "red" }
		])

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({ gameId: "game-1" })

		expect(res.status).toBe(403)
		expect(res.body).toMatchObject({
			success: false,
			message: "draw-game.messages.forbidden",
			status_code: 403
		})
		expect(gameUpdateMock).not.toHaveBeenCalled()
	})

	it("returns 403 when user is audience from 3rd join onward", async () => {
		const accessToken = buildAccessToken(11, "session-draw-3c")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 11 }))
		gameFindUniqueMock.mockResolvedValue({
			id: "game-1",
			room_id: BigInt(100),
			status: 1
		})
		roomUserFindManyMock.mockResolvedValue([
			{ user_id: BigInt(12), team: "red" },
			{ user_id: BigInt(13), team: "black" },
			{ user_id: BigInt(11), team: "red" }
		])

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({ gameId: "game-1" })

		expect(res.status).toBe(403)
		expect(res.body).toMatchObject({
			success: false,
			message: "draw-game.messages.forbidden",
			status_code: 403
		})
		expect(gameUpdateMock).not.toHaveBeenCalled()
	})

	it("returns 400 when game history is not found", async () => {
		const accessToken = buildAccessToken(11, "session-draw-4a")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 11 }))
		gameFindUniqueMock.mockResolvedValue({
			id: "game-1",
			room_id: BigInt(100),
			status: 1
		})
		roomUserFindManyMock.mockResolvedValue([
			{ user_id: BigInt(11), team: "red" },
			{ user_id: BigInt(12), team: "black" }
		])
		toArrayMock.mockResolvedValue([])

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({ gameId: "game-1" })

		expect(res.status).toBe(400)
		expect(res.body).toMatchObject({
			success: false,
			message: "draw-game.messages.game-history-not-found",
			status_code: 400
		})
		expect(insertOneMock).not.toHaveBeenCalled()
		expect(gameUpdateMock).not.toHaveBeenCalled()
	})

	it("returns 400 when game is already finished", async () => {
		const accessToken = buildAccessToken(11, "session-draw-4")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 11 }))
		gameFindUniqueMock.mockResolvedValue({
			id: "game-1",
			room_id: BigInt(100),
			status: 2
		})
		roomUserFindManyMock.mockResolvedValue([
			{ user_id: BigInt(11), team: "red" },
			{ user_id: BigInt(12), team: "black" }
		])

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({ gameId: "game-1" })

		expect(res.status).toBe(400)
		expect(res.body).toMatchObject({
			success: false,
			message: "draw-game.messages.game-already-finished",
			status_code: 400
		})
		expect(gameUpdateMock).not.toHaveBeenCalled()
	})

	it("returns 200 and updates game as draw", async () => {
		const accessToken = buildAccessToken(11, "session-draw-5")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 11 }))
		gameFindUniqueMock.mockResolvedValue({
			id: "game-1",
			room_id: BigInt(100),
			status: 1
		})
		roomUserFindManyMock.mockResolvedValue([
			{ user_id: BigInt(11), team: "red" },
			{ user_id: BigInt(12), team: "black" }
		])
		toArrayMock.mockResolvedValue([
			{ _id: { toString: () => "history-1" }, game_id: "game-1", fen: "latest-fen" }
		])
		insertOneMock.mockResolvedValue({ insertedId: { toString: () => "history-2" } })
		runEndGameTransactionMock.mockResolvedValue(true)
		roomFindUniqueMock.mockResolvedValue({ pve_mode: false })

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({ gameId: "game-1" })

		expect(res.status).toBe(200)
		expect(insertOneMock).toHaveBeenCalledWith(
			expect.objectContaining({
				game_id: "game-1",
				fen: "latest-fen",
				team: "black",
				draw: 11,
				time_stamp: expect.any(Number),
				end_reason: "draw"
			})
		)
		expect(runEndGameTransactionMock).toHaveBeenCalledWith({
			gameId: "game-1",
			roomId: BigInt(100),
			winnerId: null,
			isBotGame: false,
			betAmount: 0,
			endReason: "draw"
		})
		expect(syncPlayersPresenceMock).toHaveBeenCalledWith("game-1", false)
		expect(activatePostGameLockMock).toHaveBeenCalledWith(100n, "game-1")
		// The countdown clock is stopped when the game ends as a draw.
		expect(stopClockMock).toHaveBeenCalledWith("game-1")
		expect(res.body).toMatchObject({
			success: true,
			message: "draw-game.messages.success",
			status_code: 200
		})
	})

	it("returns 200 but skips presence sync when the game was already ended by a concurrent request", async () => {
		const accessToken = buildAccessToken(11, "session-draw-race")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 11 }))
		gameFindUniqueMock.mockResolvedValue({
			id: "game-1",
			room_id: BigInt(100),
			status: 1
		})
		roomUserFindManyMock.mockResolvedValue([
			{ user_id: BigInt(11), team: "red" },
			{ user_id: BigInt(12), team: "black" }
		])
		toArrayMock.mockResolvedValue([
			{ _id: { toString: () => "history-1" }, game_id: "game-1", fen: "latest-fen" }
		])
		insertOneMock.mockResolvedValue({ insertedId: { toString: () => "history-2" } })
		// Lost the race: another request already flipped the game to finished.
		runEndGameTransactionMock.mockResolvedValue(false)
		roomFindUniqueMock.mockResolvedValue({ pve_mode: false })

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({ gameId: "game-1" })

		expect(res.status).toBe(200)
		expect(runEndGameTransactionMock).toHaveBeenCalled()
		expect(syncPlayersPresenceMock).not.toHaveBeenCalled()
		// Lost the race -> the other request owns the shutdown, so we don't stop the clock.
		expect(stopClockMock).not.toHaveBeenCalled()
		expect(res.body).toMatchObject({
			success: true,
			message: "draw-game.messages.success",
			status_code: 200
		})
	})

	it("returns 500 when unexpected error happens", async () => {
		const accessToken = buildAccessToken(11, "session-draw-6")
		consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined)
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 11 }))
		gameFindUniqueMock.mockRejectedValue(new Error("db down"))

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({ gameId: "game-1" })

		expect(res.status).toBe(500)
		expect(res.body).toMatchObject({
			success: false,
			message: "draw-game.messages.internal-server-error",
			status_code: 500
		})
	})
})
