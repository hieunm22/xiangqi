import express from "express"
import jwt from "jsonwebtoken"
import request from "supertest"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import { INITIAL_FEN_BLACK_TOP, INITIAL_FEN_BLACK_BOTTOM } from "common/constant"
import { BOT_USER_ID } from "common/bot-engine"

const redisGetMock = vi.fn()
const transactionMock = vi.fn()
const roomUpdateMock = vi.fn()
const gameCreateMock = vi.fn()
const gameHistoryInsertOneMock = vi.fn()
const getGameHistoryCollectionMock = vi.fn()
const roomFindUniqueMock = vi.fn()
const roomUserFindManyMock = vi.fn()
const roomUserFindFirstMock = vi.fn()
const roomUserFindUniqueMock = vi.fn()
const roomUserFindManyTopMock = vi.fn()
const gameUserCreateMock = vi.fn()
const userFindUniqueMock = vi.fn()
const emitGameStartedMock = vi.fn()
const emitRoomUsersUpdatedMock = vi.fn()
const playBotMoveMock = vi.fn()
const clearPostGameLockMock = vi.fn()
const isPostGameStartBlockedMock = vi.fn()
const armClockMock = vi.fn()

const PATH = "/api/room/start"

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
			findMany: roomUserFindManyTopMock
		},
		user: {
			findUnique: userFindUniqueMock
		},
		$transaction: transactionMock
	}
}))

vi.mock("../../common/mongodb", () => ({
	getGameHistoryCollection: getGameHistoryCollectionMock
}))

vi.mock("../../common/game/presence-sync", () => ({
	syncPlayersPresence: vi.fn()
}))

vi.mock("../../common/socket", () => ({
	emitGameStarted: emitGameStartedMock,
	emitRoomUsersUpdated: emitRoomUsersUpdatedMock
}))

vi.mock("common/game/post-game.helper", () => ({
	clearPostGameLock: clearPostGameLockMock,
	isPostGameStartBlocked: isPostGameStartBlockedMock
}))

vi.mock("../../common/bot-engine/play-bot-move", () => ({
	playBotMove: playBotMoveMock
}))

vi.mock("common/game/game-clock", () => ({
	armClock: armClockMock
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
		isPostGameStartBlockedMock.mockReturnValue(false)

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
		expect(roomFindUniqueMock).not.toHaveBeenCalled()
	})

	it("returns 409 when waiting for players to press back-to-room", async () => {
		const accessToken = buildAccessToken(61, "session-start-lock")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 61 }))
		isPostGameStartBlockedMock.mockReturnValue(true)

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({ id: 101 })

		expect(res.status).toBe(409)
		expect(res.body).toMatchObject({
			success: false,
			message: "start-game.messages.waiting-players-back",
			status_code: 409
		})
		expect(roomFindUniqueMock).not.toHaveBeenCalled()
	})

	it("returns 201 when game is started successfully", async () => {
		const accessToken = buildAccessToken(61, "session-start-2")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 61 }))
		isPostGameStartBlockedMock.mockReturnValue(false)
		gameHistoryInsertOneMock.mockResolvedValue({ insertedId: "mongo-id-1" })
		roomFindUniqueMock.mockResolvedValue({ id: BigInt(101), host_id: BigInt(61), bet_amount: 50 })
		userFindUniqueMock.mockResolvedValue({ total_amount: 200 })
		getGameHistoryCollectionMock.mockResolvedValue({
			insertOne: gameHistoryInsertOneMock
		})

		roomUpdateMock.mockResolvedValue({
			id: BigInt(101),
			status: 2,
			red_first: true
		})
		gameCreateMock.mockResolvedValue({
			id: "c5afe4a6-48fd-47de-ac7e-1f635f859919",
			status: 1,
			room_id: BigInt(101),
			bot_difficulty: null
		})
		roomUserFindManyMock.mockResolvedValue([
			{ user_id: BigInt(11), team: "red" },
			{ user_id: BigInt(12), team: "black" }
		])
		gameUserCreateMock.mockResolvedValue({})
		transactionMock.mockImplementation(async callback =>
			callback({
				room: {
					update: roomUpdateMock
				},
				game: {
					create: gameCreateMock
				},
				roomUser: {
					findMany: roomUserFindManyMock
				},
				gameUser: {
					create: gameUserCreateMock
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
					status: 1,
					room_id: 101,
					bot_difficulty: null
				},
				room: {
					id: 101,
					status: 2
				}
			}
		})

		expect(roomUpdateMock).toHaveBeenCalledWith({
			where: { id: BigInt(101) },
			data: { updated_at: expect.any(Date), status: 2 },
			select: {
				id: true,
				status: true,
				red_first: true
			}
		})
		expect(gameCreateMock).toHaveBeenCalledWith({
			data: {
				status: 1,
				room_id: BigInt(101),
				bot_difficulty: null
			},
			select: {
				id: true,
				status: true,
				room_id: true,
				bot_difficulty: true
			}
		})
		expect(gameHistoryInsertOneMock).toHaveBeenCalledWith({
			game_id: "c5afe4a6-48fd-47de-ac7e-1f635f859919",
			team: "red",
			fen: `${INITIAL_FEN_BLACK_TOP} w - - 0 1`,
			time_stamp: expect.any(Number)
		})

		expect(gameUserCreateMock).toHaveBeenCalledTimes(2)
		expect(gameUserCreateMock).toHaveBeenNthCalledWith(1, {
			data: {
				game_id: "c5afe4a6-48fd-47de-ac7e-1f635f859919",
				user_id: BigInt(11),
				team: "red"
			}
		})
		expect(roomUserFindManyMock).toHaveBeenCalledWith({
			where: { room_id: BigInt(101), team: { not: null } },
			select: { user_id: true, team: true }
		})
	})

	it("seats the bot and broadcasts the is_bot flag when starting a PvE game", async () => {
		const accessToken = buildAccessToken(61, "session-start-pve")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 61 }))
		gameHistoryInsertOneMock.mockResolvedValue({ insertedId: "mongo-id-pve" })
		roomFindUniqueMock.mockResolvedValue({ id: BigInt(101), host_id: BigInt(61), bet_amount: 0 })
		getGameHistoryCollectionMock.mockResolvedValue({ insertOne: gameHistoryInsertOneMock })

		// Requester is seated on red, so the bot takes black and the human moves first.
		roomUserFindUniqueMock.mockResolvedValue({ team: "red" })

		const roomUserUpsertMock = vi.fn().mockResolvedValue({})
		roomUpdateMock.mockResolvedValue({ id: BigInt(101), status: 2, red_first: true })
		gameCreateMock.mockResolvedValue({
			id: "pve-game-uuid",
			status: 1,
			room_id: BigInt(101),
			bot_difficulty: 3
		})
		roomUserFindManyMock.mockResolvedValue([
			{ user_id: BigInt(61), team: "red" },
			{ user_id: BOT_USER_ID, team: "black" }
		])
		gameUserCreateMock.mockResolvedValue({})
		transactionMock.mockImplementation(async callback =>
			callback({
				room: { update: roomUpdateMock },
				roomUser: { upsert: roomUserUpsertMock, findMany: roomUserFindManyMock },
				game: { create: gameCreateMock },
				gameUser: { create: gameUserCreateMock }
			})
		)

		// Top-level findMany feeds the room-users broadcast (includes the bot seat).
		roomUserFindManyTopMock.mockResolvedValue([
			{
				user_id: BigInt(61),
				team: "red",
				users: { id: BigInt(61), display_name: "Host", avatar_seq: 0, total_amount: 200, is_bot: false }
			},
			{
				user_id: BOT_USER_ID,
				team: "black",
				users: { id: BOT_USER_ID, display_name: "Bot", avatar_seq: 0, total_amount: null, is_bot: true }
			}
		])

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({ id: 101, botDifficulty: 3 })

		expect(res.status).toBe(201)
		expect(res.body.data.game.bot_difficulty).toBe(3)

		// The bot is seated on the team opposite the requester.
		expect(roomUserUpsertMock).toHaveBeenCalledWith({
			where: { room_id_user_id: { room_id: BigInt(101), user_id: BOT_USER_ID } },
			create: { room_id: BigInt(101), user_id: BOT_USER_ID, team: "black" },
			update: { team: "black" }
		})

		// The broadcast carries is_bot so the client can tell the bot from the human,
		// and total_amount so the human's balance renders on the player info card.
		expect(emitRoomUsersUpdatedMock).toHaveBeenCalledWith(101, [
			expect.objectContaining({ id: 61, display_name: "Host", team: "red", total_amount: 200, is_bot: false }),
			expect.objectContaining({ id: Number(BOT_USER_ID), display_name: "Bot", team: "black", total_amount: null, is_bot: true })
		])

		// Human (red) moves first, so the bot does not auto-move on start.
		expect(playBotMoveMock).not.toHaveBeenCalled()
	})

	it("stores lowercase fen when red_first is false", async () => {
		const accessToken = buildAccessToken(61, "session-start-2b")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 61 }))
		gameHistoryInsertOneMock.mockResolvedValue({ insertedId: "mongo-id-2" })
		roomFindUniqueMock.mockResolvedValue({ id: BigInt(102), host_id: BigInt(61), bet_amount: 50 })
		userFindUniqueMock.mockResolvedValue({ total_amount: 200 })
		getGameHistoryCollectionMock.mockResolvedValue({
			insertOne: gameHistoryInsertOneMock
		})

		roomUpdateMock.mockResolvedValue({
			id: BigInt(102),
			status: 2,
			red_first: false
		})
		gameCreateMock.mockResolvedValue({
			id: "d8d18f53-95f8-4e30-b834-f4b5adce4f22",
			status: 1,
			room_id: BigInt(102),
			bot_difficulty: null
		})
		roomUserFindManyMock.mockResolvedValue([
			{ user_id: BigInt(13), team: "black" },
			{ user_id: BigInt(14), team: "red" }
		])
		gameUserCreateMock.mockResolvedValue({})
		transactionMock.mockImplementation(async callback =>
			callback({
				room: {
					update: roomUpdateMock
				},
				game: {
					create: gameCreateMock
				},
				roomUser: {
					findMany: roomUserFindManyMock
				},
				gameUser: {
					create: gameUserCreateMock
				}
			})
		)

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({ id: 102 })

		expect(res.status).toBe(201)
		expect(gameHistoryInsertOneMock).toHaveBeenCalledWith({
			game_id: "d8d18f53-95f8-4e30-b834-f4b5adce4f22",
			team: "black",
			fen: `${INITIAL_FEN_BLACK_BOTTOM} b - - 0 1`,
			time_stamp: expect.any(Number)
		})

		expect(gameUserCreateMock).toHaveBeenCalledTimes(2)
		expect(gameUserCreateMock).toHaveBeenNthCalledWith(1, {
			data: {
				game_id: "d8d18f53-95f8-4e30-b834-f4b5adce4f22",
				user_id: BigInt(13),
				team: "black"
			}
		})
		expect(gameUserCreateMock).toHaveBeenNthCalledWith(2, {
			data: {
				game_id: "d8d18f53-95f8-4e30-b834-f4b5adce4f22",
				user_id: BigInt(14),
				team: "red"
			}
		})

		expect(roomUserFindManyMock).toHaveBeenCalledWith({
			where: { room_id: BigInt(102), team: { not: null } },
			select: { user_id: true, team: true }
		})
	})

	it("snapshots the room's time limit onto a PvP game", async () => {
		const accessToken = buildAccessToken(61, "session-start-clock")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 61 }))
		isPostGameStartBlockedMock.mockReturnValue(false)
		gameHistoryInsertOneMock.mockResolvedValue({ insertedId: "mongo-id-clock" })
		roomFindUniqueMock.mockResolvedValue({
			id: BigInt(101),
			host_id: BigInt(61),
			bet_amount: 50,
			pve_mode: false,
			time_limit: 600,
			time_increment: 0,
			time_per_move: 0
		})
		userFindUniqueMock.mockResolvedValue({ total_amount: 200 })
		getGameHistoryCollectionMock.mockResolvedValue({ insertOne: gameHistoryInsertOneMock })
		roomUpdateMock.mockResolvedValue({ id: BigInt(101), status: 2, red_first: true })
		gameCreateMock.mockResolvedValue({
			id: "clocked-game-uuid",
			status: 1,
			room_id: BigInt(101),
			bot_difficulty: null
		})
		roomUserFindManyMock.mockResolvedValue([
			{ user_id: BigInt(11), team: "red" },
			{ user_id: BigInt(12), team: "black" }
		])
		gameUserCreateMock.mockResolvedValue({})
		armClockMock.mockResolvedValue({
			redMs: 600000,
			blackMs: 600000,
			activeTeam: "red",
			serverNow: 1700000000000,
			timeLimit: 600,
			timeIncrement: 0
		})
		transactionMock.mockImplementation(async callback =>
			callback({
				room: { update: roomUpdateMock },
				game: { create: gameCreateMock },
				roomUser: { findMany: roomUserFindManyMock },
				gameUser: { create: gameUserCreateMock }
			})
		)

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({ id: 101 })

		expect(res.status).toBe(201)
		expect(gameCreateMock).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({ time_limit: 600, time_increment: 0 })
			})
		)
		expect(armClockMock).toHaveBeenCalledWith("clocked-game-uuid")
		expect(emitGameStartedMock).toHaveBeenCalledWith(
			101,
			expect.objectContaining({ gameId: "clocked-game-uuid", clock: expect.objectContaining({ timeLimit: 600 }) })
		)
	})

	it("returns 403 when user is not the room host", async () => {
		const accessToken = buildAccessToken(61, "session-start-403")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 61 }))
		roomFindUniqueMock.mockResolvedValue({ id: BigInt(101), host_id: BigInt(99) })

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({ id: 101 })

		expect(res.status).toBe(403)
		expect(res.body).toMatchObject({
			success: false,
			message: "start-game.messages.forbidden",
			status_code: 403
		})
		expect(transactionMock).not.toHaveBeenCalled()
	})

	it("returns 404 when room is not found", async () => {
		const accessToken = buildAccessToken(61, "session-start-3")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 61 }))
		roomFindUniqueMock.mockResolvedValue(null)

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
		expect(roomFindUniqueMock).toHaveBeenCalledWith({
			where: { id: BigInt(999) },
			select: { id: true, host_id: true, bet_amount: true, pve_mode: true, time_limit: true, time_increment: true, time_per_move: true }
		})
		expect(transactionMock).not.toHaveBeenCalled()
	})

	it("returns 400 when bet exceeds 80% of the host's balance", async () => {
		const accessToken = buildAccessToken(61, "session-start-insufficient")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 61 }))
		roomFindUniqueMock.mockResolvedValue({ id: BigInt(101), host_id: BigInt(61), bet_amount: 100 })
		// 100 bet vs 120 balance: 100 > 120 * 0.8 (96) -> blocked.
		userFindUniqueMock.mockResolvedValue({ total_amount: 120 })

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({ id: 101 })

		expect(res.status).toBe(400)
		expect(res.body).toMatchObject({
			success: false,
			message: "start-game.messages.insufficient-amount",
			status_code: 400
		})
		expect(transactionMock).not.toHaveBeenCalled()
	})

	it("returns 500 when unexpected error happens", async () => {
		const accessToken = buildAccessToken(61, "session-start-4")
		consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined)
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 61 }))
		roomFindUniqueMock.mockResolvedValue({ id: BigInt(101), host_id: BigInt(61) })
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
