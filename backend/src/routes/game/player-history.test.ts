import express from "express"
import jwt from "jsonwebtoken"
import request from "supertest"
import {
	afterEach,
	beforeAll,
	describe,
	expect,
	it,
	vi
} from "vitest"

const redisGetMock = vi.fn()
const gameUserFindManyMock = vi.fn()
const gameFindManyMock = vi.fn()

const PATH = "/api/game/player-history"

vi.mock("../../common/redis", () => ({
	default: {
		get: redisGetMock
	}
}))

vi.mock("prisma", () => ({
	default: {
		gameUser: {
			findMany: gameUserFindManyMock
		},
		game: {
			findMany: gameFindManyMock
		}
	}
}))

describe("GET /api/game/player-history", () => {
	let app: express.Express

	beforeAll(async () => {
		process.env.JWT_SECRET = "unit-test-secret"
		process.env.JWT_ISSUER = "unit-test-issuer"

		const { default: playerHistoryRoutes } = await import("./player-history")
		app = express()
		app.use(express.json())
		app.use("/api", playerHistoryRoutes)
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
		const res = await request(app).get(`${PATH}?userId=1`)

		expect(res.status).toBe(401)
		expect(res.body).toMatchObject({
			success: false,
			message: "auth-middleware.messages.token-required",
			status_code: 401
		})
	})

	it("returns 400 when userId query param is missing", async () => {
		const token = buildAccessToken(1, "session-ph-1")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 1 }))

		const res = await request(app)
			.get(PATH)
			.set("Authorization", `Bearer ${token}`)

		expect(res.status).toBe(400)
		expect(res.body).toMatchObject({
			success: false,
			message: "player-history.messages.invalid-user-id",
			status_code: 400
		})
	})

	it("returns 400 when userId is not a number", async () => {
		const token = buildAccessToken(1, "session-ph-2")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 1 }))

		const res = await request(app)
			.get(`${PATH}?userId=abc`)
			.set("Authorization", `Bearer ${token}`)

		expect(res.status).toBe(400)
		expect(res.body).toMatchObject({
			success: false,
			message: "player-history.messages.invalid-user-id",
			status_code: 400
		})
	})

	it.each([0, -1, -5])("returns 400 when userId is non-positive (%i)", async (userId) => {
		const token = buildAccessToken(1, "session-ph-3")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 1 }))

		const res = await request(app)
			.get(`${PATH}?userId=${userId}`)
			.set("Authorization", `Bearer ${token}`)

		expect(res.status).toBe(400)
		expect(res.body).toMatchObject({
			success: false,
			message: "player-history.messages.invalid-user-id",
			status_code: 400
		})
	})

	it("returns 200 with empty array when user has no games", async () => {
		const token = buildAccessToken(1, "session-ph-5")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 1 }))
		gameUserFindManyMock.mockResolvedValueOnce([])

		const res = await request(app)
			.get(`${PATH}?userId=1`)
			.set("Authorization", `Bearer ${token}`)

		expect(res.status).toBe(200)
		expect(res.body).toMatchObject({
			success: true,
			message: "player-history.messages.success",
			status_code: 200,
			data: []
		})
	})

	it("returns 200 with empty array when user has no finished games", async () => {
		const token = buildAccessToken(1, "session-ph-6")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 1 }))

		// User has games but none are finished (status=2)
		gameUserFindManyMock.mockResolvedValueOnce([
			{ game_id: "game-1", amount: 10 }
		])
		gameFindManyMock.mockResolvedValueOnce([]) // no finished games

		const res = await request(app)
			.get(`${PATH}?userId=1`)
			.set("Authorization", `Bearer ${token}`)

		expect(res.status).toBe(200)
		expect(res.body).toMatchObject({
			success: true,
			message: "player-history.messages.success",
			status_code: 200,
			data: []
		})
	})

	it("returns 200 with game history list for finished games", async () => {
		const token = buildAccessToken(1, "session-ph-7")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 1 }))

		// Step 1: user's game list
		gameUserFindManyMock.mockResolvedValueOnce([
			{ game_id: "game-1", amount: 10 }
		])

		// Step 2: finished games
		gameFindManyMock.mockResolvedValueOnce([
			{ id: "game-1" }
		])

		// Step 3: all game_users for finished games
		gameUserFindManyMock.mockResolvedValueOnce([
			{
				game_id: "game-1",
				user_id: BigInt(1),
				amount: 10,
				team: "red",
				games: { ends_at: new Date("2025-01-10T10:00:00Z"), winner_id: BigInt(1) },
				users: { id: BigInt(1), display_name: "Player One", avatar_seq: BigInt(0), is_bot: false }
			},
			{
				game_id: "game-1",
				user_id: BigInt(2),
				amount: -10,
				team: "black",
				games: { ends_at: new Date("2025-01-10T10:00:00Z"), winner_id: BigInt(1) },
				users: { id: BigInt(2), display_name: "Player Two", avatar_seq: BigInt(1), is_bot: false }
			}
		])

		const res = await request(app)
			.get(`${PATH}?userId=1`)
			.set("Authorization", `Bearer ${token}`)

		expect(res.status).toBe(200)
		expect(res.body).toMatchObject({
			success: true,
			message: "player-history.messages.success",
			status_code: 200,
			data: [
				{
					game: {
						gameId: "game-1",
						ends_at: expect.any(String),
						winner_id: 1
					},
					amount: 10,
					users: expect.arrayContaining([
						{ id: 1, display_name: "Player One", avatar_url: "/images/1.jpg", team: "red" },
						{ id: 2, display_name: "Player Two", avatar_url: "/images/2_1.jpg", team: "black" }
					])
				}
			]
		})
	})

	it("returns 200 with multiple finished games", async () => {
		const token = buildAccessToken(1, "session-ph-8")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 1 }))

		gameUserFindManyMock.mockResolvedValueOnce([
			{ game_id: "game-1", amount: 10 },
			{ game_id: "game-2", amount: -10 }
		])

		gameFindManyMock.mockResolvedValueOnce([
			{ id: "game-1" },
			{ id: "game-2" }
		])

		gameUserFindManyMock.mockResolvedValueOnce([
			{
				game_id: "game-1",
				user_id: BigInt(1),
				amount: 10,
				games: { ends_at: new Date("2025-01-10T10:00:00Z") },
				users: { id: BigInt(1), display_name: "Player One", avatar_seq: BigInt(0) }
			},
			{
				game_id: "game-1",
				user_id: BigInt(2),
				amount: -10,
				games: { ends_at: new Date("2025-01-10T10:00:00Z") },
				users: { id: BigInt(2), display_name: "Player Two", avatar_seq: BigInt(0) }
			},
			{
				game_id: "game-2",
				user_id: BigInt(1),
				amount: -10,
				games: { ends_at: new Date("2025-01-20T15:00:00Z") },
				users: { id: BigInt(1), display_name: "Player One", avatar_seq: BigInt(0) }
			},
			{
				game_id: "game-2",
				user_id: BigInt(3),
				amount: 10,
				games: { ends_at: new Date("2025-01-20T15:00:00Z") },
				users: { id: BigInt(3), display_name: "Player Three", avatar_seq: BigInt(0) }
			}
		])

		const res = await request(app)
			.get(`${PATH}?userId=1`)
			.set("Authorization", `Bearer ${token}`)

		expect(res.status).toBe(200)
		expect(res.body.data).toHaveLength(2)
		expect(res.body.data.find((g: any) => g.game.gameId === "game-1").amount).toBe(10)
		expect(res.body.data.find((g: any) => g.game.gameId === "game-2").amount).toBe(-10)
	})

	it("uses amount from the requested user's record (not opponent)", async () => {
		const token = buildAccessToken(2, "session-ph-9")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 2 }))

		gameUserFindManyMock.mockResolvedValueOnce([
			{ game_id: "game-1", amount: -10 }
		])

		gameFindManyMock.mockResolvedValueOnce([
			{ id: "game-1" }
		])

		gameUserFindManyMock.mockResolvedValueOnce([
			{
				game_id: "game-1",
				user_id: BigInt(1),
				amount: 10,
				games: { ends_at: new Date("2025-01-10T10:00:00Z") },
				users: { id: BigInt(1), display_name: "Player One", avatar_seq: BigInt(0) }
			},
			{
				game_id: "game-1",
				user_id: BigInt(2),
				amount: -10,
				games: { ends_at: new Date("2025-01-10T10:00:00Z") },
				users: { id: BigInt(2), display_name: "Player Two", avatar_seq: BigInt(0) }
			}
		])

		const res = await request(app)
			.get(`${PATH}?userId=2`)
			.set("Authorization", `Bearer ${token}`)

		expect(res.status).toBe(200)
		expect(res.body.data[0].amount).toBe(-10)
	})

	it("returns 500 when database throws an error", async () => {
		const token = buildAccessToken(1, "session-ph-10")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 1 }))
		gameUserFindManyMock.mockRejectedValueOnce(new Error("DB connection lost"))

		const res = await request(app)
			.get(`${PATH}?userId=1`)
			.set("Authorization", `Bearer ${token}`)

		expect(res.status).toBe(500)
		expect(res.body).toMatchObject({
			success: false,
			message: "player-history.messages.internal-server-error",
			status_code: 500
		})
	})

	it("returns games ordered by ends_at descending (newest first)", async () => {
		const token = buildAccessToken(1, "session-ph-11")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 1 }))

		// Step 1: User has two games
		gameUserFindManyMock.mockResolvedValueOnce([
			{ game_id: "game-1", amount: 10 },
			{ game_id: "game-2", amount: -5 }
		])

		// Step 2: Finished games ordered by ends_at (mock provides desc order)
		gameFindManyMock.mockResolvedValueOnce([
			{ id: "game-2", ends_at: new Date("2025-01-20T15:00:00Z") }, // newer
			{ id: "game-1", ends_at: new Date("2025-01-10T10:00:00Z") }  // older
		])

		// Step 3: All game_users ordered by game.ends_at (desc)
		gameUserFindManyMock.mockResolvedValueOnce([
			// game-2 records first (newer ends_at)
			{
				game_id: "game-2",
				user_id: BigInt(1),
				amount: -5,
				games: { ends_at: new Date("2025-01-20T15:00:00Z") },
				users: { id: BigInt(1), display_name: "Player One", avatar_seq: BigInt(0) }
			},
			{
				game_id: "game-2",
				user_id: BigInt(3),
				amount: 5,
				games: { ends_at: new Date("2025-01-20T15:00:00Z") },
				users: { id: BigInt(3), display_name: "Player Three", avatar_seq: BigInt(1) }
			},
			// game-1 records next (older ends_at)
			{
				game_id: "game-1",
				user_id: BigInt(1),
				amount: 10,
				games: { ends_at: new Date("2025-01-10T10:00:00Z") },
				users: { id: BigInt(1), display_name: "Player One", avatar_seq: BigInt(0) }
			},
			{
				game_id: "game-1",
				user_id: BigInt(2),
				amount: -10,
				games: { ends_at: new Date("2025-01-10T10:00:00Z") },
				users: { id: BigInt(2), display_name: "Player Two", avatar_seq: BigInt(0) }
			}
		])

		const res = await request(app)
			.get(`${PATH}?userId=1`)
			.set("Authorization", `Bearer ${token}`)

		expect(res.status).toBe(200)
		expect(res.body.data).toHaveLength(2)
		// game-2 (newer) should come first
		expect(res.body.data[0].game.gameId).toBe("game-2")
		expect(res.body.data[0].amount).toBe(-5)
		// game-1 (older) should come second
		expect(res.body.data[1].game.gameId).toBe("game-1")
		expect(res.body.data[1].amount).toBe(10)
	})

	// A PvE game between user 1 (human) and the bot. The human won, so the game's
	// winner_id is the human even though amount stays null (no coin stake).
	const botGameRows = [
		{
			game_id: "bot-game-1",
			user_id: BigInt(1),
			amount: null,
			team: "red",
			games: { ends_at: new Date("2025-02-01T10:00:00Z"), winner_id: BigInt(1) },
			users: { id: BigInt(1), display_name: "Player One", avatar_seq: BigInt(0), is_bot: false }
		},
		{
			game_id: "bot-game-1",
			user_id: BigInt(9223372036854),
			amount: null,
			team: "black",
			games: { ends_at: new Date("2025-02-01T10:00:00Z"), winner_id: BigInt(1) },
			users: { id: BigInt(9223372036854), display_name: "Bot", avatar_seq: BigInt(0), is_bot: true }
		}
	]

	it("exposes winner_id for a bot game so it is not shown as a draw (own history)", async () => {
		const token = buildAccessToken(1, "session-ph-12")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 1 }))

		gameUserFindManyMock.mockResolvedValueOnce([{ game_id: "bot-game-1" }])
		gameFindManyMock.mockResolvedValueOnce([{ id: "bot-game-1" }])
		gameUserFindManyMock.mockResolvedValueOnce(botGameRows)

		const res = await request(app)
			.get(`${PATH}?userId=1`)
			.set("Authorization", `Bearer ${token}`)

		expect(res.status).toBe(200)
		expect(res.body.data).toHaveLength(1)
		expect(res.body.data[0].game.gameId).toBe("bot-game-1")
		// amount still normalizes to 0 (no coin stake) ...
		expect(res.body.data[0].amount).toBe(0)
		// ... but winner_id identifies the human winner, so the UI shows a win, not a draw.
		expect(res.body.data[0].game.winner_id).toBe(1)
	})

	it("hides bot games when a different user views the history", async () => {
		// Viewer is user 2, browsing user 1's profile history.
		const token = buildAccessToken(2, "session-ph-13")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 2 }))

		gameUserFindManyMock.mockResolvedValueOnce([{ game_id: "bot-game-1" }])
		gameFindManyMock.mockResolvedValueOnce([{ id: "bot-game-1" }])
		gameUserFindManyMock.mockResolvedValueOnce(botGameRows)

		const res = await request(app)
			.get(`${PATH}?userId=1`)
			.set("Authorization", `Bearer ${token}`)

		expect(res.status).toBe(200)
		expect(res.body.data).toEqual([])
	})

	it("still shows PvP games when a different user views the history", async () => {
		// Viewer is user 3, browsing user 1's profile; the PvP game stays visible.
		const token = buildAccessToken(3, "session-ph-14")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 3 }))

		gameUserFindManyMock.mockResolvedValueOnce([{ game_id: "game-1" }])
		gameFindManyMock.mockResolvedValueOnce([{ id: "game-1" }])
		gameUserFindManyMock.mockResolvedValueOnce([
			{
				game_id: "game-1",
				user_id: BigInt(1),
				amount: 10,
				team: "red",
				games: { ends_at: new Date("2025-01-10T10:00:00Z"), winner_id: BigInt(1) },
				users: { id: BigInt(1), display_name: "Player One", avatar_seq: BigInt(0), is_bot: false }
			},
			{
				game_id: "game-1",
				user_id: BigInt(2),
				amount: -10,
				team: "black",
				games: { ends_at: new Date("2025-01-10T10:00:00Z"), winner_id: BigInt(1) },
				users: { id: BigInt(2), display_name: "Player Two", avatar_seq: BigInt(1), is_bot: false }
			}
		])

		const res = await request(app)
			.get(`${PATH}?userId=1`)
			.set("Authorization", `Bearer ${token}`)

		expect(res.status).toBe(200)
		expect(res.body.data).toHaveLength(1)
		expect(res.body.data[0].game.gameId).toBe("game-1")
		expect(res.body.data[0].game.winner_id).toBe(1)
	})
})
