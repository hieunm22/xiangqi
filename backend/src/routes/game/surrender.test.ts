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

const PATH = "/api/game/surrender"

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

describe("POST /api/game/surrender", () => {
	let app: express.Express
	let consoleErrorSpy: ReturnType<typeof vi.spyOn>

	beforeAll(async () => {
		process.env.JWT_SECRET = "unit-test-secret"
		process.env.JWT_ISSUER = "unit-test-issuer"

		const { default: surrenderRoutes } = await import("./surrender")
		app = express()
		app.use(express.json())
		app.use("/api", surrenderRoutes)
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
		const accessToken = buildAccessToken(11, "session-surrender-1")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 11 }))

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({ gameId: 123 })

		expect(res.status).toBe(400)
		expect(res.body).toMatchObject({
			success: false,
			message: "surrender.messages.invalid-game-id",
			status_code: 400
		})
		expect(gameFindUniqueMock).not.toHaveBeenCalled()
	})

	it("returns 404 when game is not found", async () => {
		const accessToken = buildAccessToken(11, "session-surrender-2")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 11 }))
		gameFindUniqueMock.mockResolvedValue(null)

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({ gameId: "game-1" })

		expect(res.status).toBe(404)
		expect(res.body).toMatchObject({
			success: false,
			message: "surrender.messages.game-not-found",
			status_code: 404
		})
	})

	it("returns 400 when game history is not found", async () => {
		const accessToken = buildAccessToken(11, "session-surrender-3")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 11 }))
		gameFindUniqueMock.mockResolvedValue({
			id: "game-1",
			room_id: BigInt(100),
			status: 0
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
		expect(findMock).toHaveBeenCalledWith({
			$or: [{ game_id: "game-1" }, { gameId: "game-1" }]
		})
		expect(res.body).toMatchObject({
			success: false,
			message: "surrender.messages.game-history-not-found",
			status_code: 400
		})
		expect(insertOneMock).not.toHaveBeenCalled()
		expect(gameUpdateMock).not.toHaveBeenCalled()
	})

	it("returns 200 and records surrender successfully", async () => {
		const accessToken = buildAccessToken(11, "session-surrender-4")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 11 }))
		gameFindUniqueMock.mockResolvedValue({
			id: "game-1",
			room_id: BigInt(100),
			status: 0
		})
		roomFindUniqueMock.mockResolvedValue({
			id: BigInt(100),
			pve_mode: false,
			bet_amount: 50
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
				time_stamp: expect.any(Number),
				surrender_id: 11,
				winner_id: 12,
				end_reason: "surrender"
			})
		)
		expect(runEndGameTransactionMock).toHaveBeenCalledWith({
			gameId: "game-1",
			roomId: BigInt(100),
			winnerId: BigInt(12),
			isBotGame: false,
			betAmount: 50,
			endReason: "surrender"
		})
		expect(syncPlayersPresenceMock).toHaveBeenCalledWith("game-1", false)
		expect(activatePostGameLockMock).toHaveBeenCalledWith(100n, "game-1")
		// Surrender ends the game -> the countdown clock is stopped.
		expect(stopClockMock).toHaveBeenCalledWith("game-1")
		expect(res.body).toMatchObject({
			success: true,
			message: "surrender.messages.success",
			status_code: 200
		})
	})

	it("returns 200 but skips presence sync when the game was already ended by a concurrent request", async () => {
		const accessToken = buildAccessToken(11, "session-surrender-race")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 11 }))
		gameFindUniqueMock.mockResolvedValue({
			id: "game-1",
			room_id: BigInt(100),
			status: 0
		})
		roomFindUniqueMock.mockResolvedValue({
			id: BigInt(100),
			pve_mode: false,
			bet_amount: 50
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
			message: "surrender.messages.success",
			status_code: 200
		})
	})

	it("returns 500 when unexpected error happens", async () => {
		const accessToken = buildAccessToken(11, "session-surrender-5")
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
			message: "surrender.messages.internal-server-error",
			status_code: 500
		})
	})
})
