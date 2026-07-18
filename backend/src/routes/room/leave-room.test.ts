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
const getGameHistoryCollectionMock = vi.fn()
const runEndGameTransactionMock = vi.fn()
const syncPlayersPresenceMock = vi.fn()
const transactionMock = vi.fn()

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
		},
		$transaction: transactionMock
	}
}))

vi.mock("common/bot-engine", () => ({
	BOT_USER_ID: BigInt(999),
	engineManager: {
		releaseEngine: releaseEngineMock
	}
}))

vi.mock("common/socket", () => ({
	emitRoomUsersUpdated: emitRoomUsersUpdatedMock,
	emitRoomDeleted: emitRoomDeletedMock
}))

vi.mock("common/mongodb", () => ({
	getGameHistoryCollection: getGameHistoryCollectionMock
}))

vi.mock("common/game/end-game.helper", () => ({
	runEndGameTransaction: runEndGameTransactionMock
}))

vi.mock("common/game/presence-sync", () => ({
	syncPlayersPresence: syncPlayersPresenceMock
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
		roomUserFindManyMock.mockResolvedValue([
			{
				joined_at: new Date("2026-05-26T00:00:00.000Z"),
				team: "red",
				user_id: BigInt(88),
				users: {
					id: BigInt(88),
					display_name: "Room owner",
					avatar_seq: 0,
					total_amount: undefined,
					is_bot: false
				}
			}
		])

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

	it("spectator leaving removes only spectator in PvP room", async () => {
		const accessToken = buildAccessToken(51, "session-leave-3")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 51 }))
		roomFindUniqueMock.mockResolvedValue({ id: BigInt(101), pve_mode: false, status: 1, bet_amount: 100 })
		roomUserFindManyMock.mockResolvedValue([
			{
				joined_at: new Date("2026-05-26T00:00:00.000Z"),
				team: "red",
				user_id: BigInt(88),
				users: {
					id: BigInt(88),
					display_name: "Room owner",
					avatar_seq: 0,
					total_amount: undefined,
					is_bot: false
				}
			},
			{
				joined_at: new Date("2026-05-26T00:00:01.000Z"),
				team: null,
				user_id: BigInt(51),
				users: {
					id: BigInt(51),
					display_name: "Spectator",
					avatar_seq: 1,
					total_amount: undefined,
					is_bot: false
				}
			}
		])
		roomUserDeleteManyMock.mockResolvedValue({ count: 1 })
		roomUserCountMock.mockResolvedValue(1)

		const res = await request(app)
			.delete(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({ id: 101 })

		expect(res.status).toBe(200)
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
				total_amount: undefined,
				is_bot: false,
				joined_at: new Date("2026-05-26T00:00:00.000Z")
			}
		])
	})

	it("player leaving removes only player in PvP room with other players remaining", async () => {
		const accessToken = buildAccessToken(51, "session-leave-3b")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 51 }))
		roomFindUniqueMock.mockResolvedValue({ id: BigInt(101), pve_mode: false, status: 1, bet_amount: 100 })
		roomUserFindManyMock.mockResolvedValue([
			{
				joined_at: new Date("2026-05-26T00:00:00.000Z"),
				team: "red",
				user_id: BigInt(51),
				users: {
					id: BigInt(51),
					display_name: "Player A",
					avatar_seq: 0,
					total_amount: undefined,
					is_bot: false
				}
			},
			{
				joined_at: new Date("2026-05-26T00:00:01.000Z"),
				team: "black",
				user_id: BigInt(52),
				users: {
					id: BigInt(52),
					display_name: "Player B",
					avatar_seq: 1,
					total_amount: undefined,
					is_bot: false
				}
			}
		])
		gameFindFirstMock.mockResolvedValue(null)
		roomUserDeleteManyMock.mockResolvedValue({ count: 1 })
		roomUserCountMock.mockResolvedValue(1)

		const res = await request(app)
			.delete(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({ id: 101 })

		expect(res.status).toBe(200)
		expect(roomUserDeleteManyMock).toHaveBeenCalledWith({
			where: {
				room_id: BigInt(101),
				user_id: BigInt(51)
			}
		})
		expect(roomUpdateMock).not.toHaveBeenCalled()
		expect(emitRoomUsersUpdatedMock).toHaveBeenCalledWith(101, [
			{
				id: 52,
				display_name: "Player B",
				avatar_seq: 1,
				avatar_url: "/images/52_1.jpg",
				team: "black",
				total_amount: undefined,
				is_bot: false,
				joined_at: new Date("2026-05-26T00:00:01.000Z")
			}
		])
	})

	it("reassigns host to earliest remaining real user when the host leaves a PvP room", async () => {
		const accessToken = buildAccessToken(51, "session-leave-host")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 51 }))
		roomFindUniqueMock.mockResolvedValue({
			id: BigInt(101),
			pve_mode: false,
			status: 1,
			bet_amount: 100,
			host_id: BigInt(51)
		})
		roomUserFindManyMock.mockResolvedValue([
			{
				joined_at: new Date("2026-05-26T00:00:00.000Z"),
				team: "red",
				user_id: BigInt(51),
				users: { id: BigInt(51), display_name: "Host", avatar_seq: 0, total_amount: undefined, is_bot: false }
			},
			{
				joined_at: new Date("2026-05-26T00:00:01.000Z"),
				team: "black",
				user_id: BigInt(52),
				users: { id: BigInt(52), display_name: "Player B", avatar_seq: 1, total_amount: undefined, is_bot: false }
			}
		])
		gameFindFirstMock.mockResolvedValue(null)
		roomUserDeleteManyMock.mockResolvedValue({ count: 1 })
		roomUserCountMock.mockResolvedValue(1)
		roomUpdateMock.mockResolvedValue({})

		const res = await request(app)
			.delete(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({ id: 101 })

		expect(res.status).toBe(200)
		// Host role transferred to the next earliest remaining real user (52)
		expect(roomUpdateMock).toHaveBeenCalledWith({
			where: { id: BigInt(101) },
			data: { host_id: BigInt(52) }
		})
		expect(emitRoomUsersUpdatedMock).toHaveBeenCalledWith(
			101,
			[
				{
					id: 52,
					display_name: "Player B",
					avatar_seq: 1,
					avatar_url: "/images/52_1.jpg",
					team: "black",
					total_amount: undefined,
					is_bot: false,
					joined_at: new Date("2026-05-26T00:00:01.000Z")
				}
			],
			52
		)
	})

	it("prefers the seated opponent over an earlier-joined spectator when the host leaves", async () => {
		const accessToken = buildAccessToken(51, "session-leave-host-priority")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 51 }))
		roomFindUniqueMock.mockResolvedValue({
			id: BigInt(101),
			pve_mode: false,
			status: 1,
			bet_amount: 100,
			host_id: BigInt(51)
		})
		// Join order: host (t0) → spectator (t1) → opponent (t2). The spectator joined
		// before the opponent, but the seated opponent must still receive the host role.
		roomUserFindManyMock.mockResolvedValue([
			{
				joined_at: new Date("2026-05-26T00:00:00.000Z"),
				team: "red",
				user_id: BigInt(51),
				users: { id: BigInt(51), display_name: "Host", avatar_seq: 0, total_amount: undefined, is_bot: false }
			},
			{
				joined_at: new Date("2026-05-26T00:00:01.000Z"),
				team: null,
				user_id: BigInt(77),
				users: { id: BigInt(77), display_name: "Spectator", avatar_seq: 2, total_amount: undefined, is_bot: false }
			},
			{
				joined_at: new Date("2026-05-26T00:00:02.000Z"),
				team: "black",
				user_id: BigInt(52),
				users: { id: BigInt(52), display_name: "Player B", avatar_seq: 1, total_amount: undefined, is_bot: false }
			}
		])
		gameFindFirstMock.mockResolvedValue(null)
		roomUserDeleteManyMock.mockResolvedValue({ count: 1 })
		roomUserCountMock.mockResolvedValue(2)
		roomUpdateMock.mockResolvedValue({})

		const res = await request(app)
			.delete(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({ id: 101 })

		expect(res.status).toBe(200)
		// Host goes to the seated opponent (52), not the earlier-joined spectator (77)
		expect(roomUpdateMock).toHaveBeenCalledWith({
			where: { id: BigInt(101) },
			data: { host_id: BigInt(52) }
		})
		expect(emitRoomUsersUpdatedMock).toHaveBeenCalledWith(
			101,
			[
				{
					id: 77,
					display_name: "Spectator",
					avatar_seq: 2,
					avatar_url: "/images/77_2.jpg",
					team: null,
					total_amount: undefined,
					is_bot: false,
					joined_at: new Date("2026-05-26T00:00:01.000Z")
				},
				{
					id: 52,
					display_name: "Player B",
					avatar_seq: 1,
					avatar_url: "/images/52_1.jpg",
					team: "black",
					total_amount: undefined,
					is_bot: false,
					joined_at: new Date("2026-05-26T00:00:02.000Z")
				}
			],
			52
		)
		expect(emitRoomDeletedMock).not.toHaveBeenCalled()
	})

	it("deactivates the room and clears host when only a bot remains after the host leaves", async () => {
		const accessToken = buildAccessToken(51, "session-leave-host-nobody")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 51 }))
		roomFindUniqueMock.mockResolvedValue({
			id: BigInt(101),
			pve_mode: false,
			status: 1,
			bet_amount: 100,
			host_id: BigInt(51)
		})
		// Host is a spectator (team null); the only other member is the bot, which can
		// never be host → the room must be deactivated and host cleared.
		roomUserFindManyMock.mockResolvedValue([
			{
				joined_at: new Date("2026-05-26T00:00:00.000Z"),
				team: null,
				user_id: BigInt(51),
				users: { id: BigInt(51), display_name: "Host", avatar_seq: 0, total_amount: undefined, is_bot: false }
			},
			{
				joined_at: new Date("2026-05-26T00:00:01.000Z"),
				team: "black",
				user_id: BigInt(999),
				users: { id: BigInt(999), display_name: "Bot", avatar_seq: 0, total_amount: undefined, is_bot: true }
			}
		])
		roomUserDeleteManyMock.mockResolvedValue({ count: 1 })
		roomUserCountMock.mockResolvedValue(1)
		roomUpdateMock.mockResolvedValue({})

		const res = await request(app)
			.delete(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({ id: 101 })

		expect(res.status).toBe(200)
		expect(roomUpdateMock).toHaveBeenCalledWith({
			where: { id: BigInt(101) },
			data: { host_id: null, is_active: false }
		})
		expect(emitRoomDeletedMock).toHaveBeenCalledWith(101)
		expect(emitRoomUsersUpdatedMock).not.toHaveBeenCalled()
	})

	it("does not promote spectator when a player leaves", async () => {
		const accessToken = buildAccessToken(51, "session-leave-3c")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 51 }))
		roomFindUniqueMock.mockResolvedValue({ id: BigInt(101), pve_mode: false, status: 1, bet_amount: 100 })
		roomUserFindManyMock.mockResolvedValue([
			{
				joined_at: new Date("2026-05-26T00:00:00.000Z"),
				team: "red",
				user_id: BigInt(51),
				users: {
					id: BigInt(51),
					display_name: "Player A",
					avatar_seq: 0,
					total_amount: undefined,
					is_bot: false
				}
			},
			{
				joined_at: new Date("2026-05-26T00:00:01.000Z"),
				team: null,
				user_id: BigInt(77),
				users: {
					id: BigInt(77),
					display_name: "Spectator",
					avatar_seq: 2,
					total_amount: undefined,
					is_bot: false
				}
			}
		])
		gameFindFirstMock.mockResolvedValue(null)
		roomUserDeleteManyMock.mockResolvedValue({ count: 1 })
		roomUserCountMock.mockResolvedValue(1)

		const res = await request(app)
			.delete(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({ id: 101 })

		expect(res.status).toBe(200)
		expect(roomUserUpdateMock).not.toHaveBeenCalled()
		expect(emitRoomUsersUpdatedMock).toHaveBeenCalledWith(101, [
			{
				id: 77,
				display_name: "Spectator",
				avatar_seq: 2,
				avatar_url: "/images/77_2.jpg",
				team: null,
				total_amount: undefined,
				is_bot: false,
				joined_at: new Date("2026-05-26T00:00:01.000Z")
			}
		])
	})

	it("soft-deletes (is_active=false) room when no players remain in a PvP room", async () => {
		const accessToken = buildAccessToken(51, "session-leave-4")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 51 }))
		roomFindUniqueMock.mockResolvedValue({ id: BigInt(101), pve_mode: false, status: 1, bet_amount: 100 })
		roomUserFindManyMock.mockResolvedValue([
			{
				joined_at: new Date("2026-05-26T00:00:00.000Z"),
				team: "red",
				user_id: BigInt(51),
				users: {
					id: BigInt(51),
					display_name: "Player A",
					avatar_seq: 0
				}
			}
		])
		gameFindFirstMock.mockResolvedValue(null)
		roomUserDeleteManyMock.mockResolvedValue({ count: 1 })
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
		roomFindUniqueMock.mockResolvedValue({ id: BigInt(101), pve_mode: true, status: 1, bet_amount: 100 })
		roomUserFindManyMock.mockResolvedValue([
			{
				joined_at: new Date("2026-05-26T00:00:00.000Z"),
				team: "red",
				user_id: BigInt(51),
				users: {
					id: BigInt(51),
					display_name: "Player A",
					avatar_seq: 0
				}
			},
			{
				joined_at: new Date("2026-05-26T00:00:01.000Z"),
				team: "black",
				user_id: BigInt(999),
				users: {
					id: BigInt(999),
					display_name: "Bot",
					avatar_seq: 0
				}
			}
		])
		gameFindFirstMock.mockResolvedValue({ id: "game-uuid-1" })
		const leaveInsertOneMock = vi.fn().mockResolvedValue({})
		getGameHistoryCollectionMock.mockResolvedValue({
			find: vi.fn().mockReturnValue({
				sort: vi.fn().mockReturnValue({
					limit: vi.fn().mockReturnValue({
						toArray: vi.fn().mockResolvedValue([{ fen: "rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/RNBAKABNR w - - 0 1" }])
					})
				})
			}),
			insertOne: leaveInsertOneMock
		})
		runEndGameTransactionMock.mockResolvedValue(true)
		releaseEngineMock.mockResolvedValue(undefined)
		roomUpdateMock.mockResolvedValue({ id: BigInt(101), is_active: false })

		const res = await request(app)
			.delete(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({ id: 101 })

		expect(res.status).toBe(200)
		expect(gameFindFirstMock).toHaveBeenCalledWith({
			where: { room_id: BigInt(101), status: 1 },
			select: { id: true }
		})
		expect(runEndGameTransactionMock).toHaveBeenCalledWith({
			gameId: "game-uuid-1",
			roomId: BigInt(101),
			winnerId: BigInt(999),
			isBotGame: true,
			betAmount: 100,
			endReason: "leave"
		})
		// The terminal record records the winner (bot) alongside who left.
		expect(leaveInsertOneMock).toHaveBeenCalledWith(
			expect.objectContaining({
				game_id: "game-uuid-1",
				leave: 51,
				winner_id: 999,
				end_reason: "leave"
			})
		)
		expect(syncPlayersPresenceMock).toHaveBeenCalledWith("game-uuid-1", false)
		expect(roomUserDeleteManyMock).toHaveBeenCalledWith({
			where: { room_id: BigInt(101) }
		})
		expect(roomUpdateMock).toHaveBeenCalledWith({
			where: { id: BigInt(101) },
			data: { is_active: false }
		})
		expect(releaseEngineMock).toHaveBeenCalledWith("game-uuid-1")
		expect(emitRoomDeletedMock).toHaveBeenCalledWith(101)
	})

	it("on PvE leave: skips presence sync and engine release when the game was already ended by a concurrent request", async () => {
		const accessToken = buildAccessToken(51, "session-leave-pve-race")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 51 }))
		roomFindUniqueMock.mockResolvedValue({ id: BigInt(101), pve_mode: true, status: 1, bet_amount: 100 })
		roomUserFindManyMock.mockResolvedValue([
			{
				joined_at: new Date("2026-05-26T00:00:00.000Z"),
				team: "red",
				user_id: BigInt(51),
				users: { id: BigInt(51), display_name: "Player A", avatar_seq: 0 }
			},
			{
				joined_at: new Date("2026-05-26T00:00:01.000Z"),
				team: "black",
				user_id: BigInt(999),
				users: { id: BigInt(999), display_name: "Bot", avatar_seq: 0 }
			}
		])
		gameFindFirstMock.mockResolvedValue({ id: "game-uuid-1" })
		getGameHistoryCollectionMock.mockResolvedValue({
			find: vi.fn().mockReturnValue({
				sort: vi.fn().mockReturnValue({
					limit: vi.fn().mockReturnValue({
						toArray: vi.fn().mockResolvedValue([{ fen: "rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/RNBAKABNR w - - 0 1" }])
					})
				})
			}),
			insertOne: vi.fn().mockResolvedValue({})
		})
		// Lost the race: another request already flipped the game to finished.
		runEndGameTransactionMock.mockResolvedValue(false)
		roomUpdateMock.mockResolvedValue({ id: BigInt(101), is_active: false })

		const res = await request(app)
			.delete(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({ id: 101 })

		expect(res.status).toBe(200)
		expect(runEndGameTransactionMock).toHaveBeenCalled()
		// Game-over side effects skipped, but the room is still cleaned up.
		expect(syncPlayersPresenceMock).not.toHaveBeenCalled()
		expect(releaseEngineMock).not.toHaveBeenCalled()
		expect(roomUserDeleteManyMock).toHaveBeenCalledWith({
			where: { room_id: BigInt(101) }
		})
		expect(emitRoomDeletedMock).toHaveBeenCalledWith(101)
	})

	it("on PvE leave: spectator leaving removes only spectator, leaves player and bot", async () => {
		const accessToken = buildAccessToken(52, "session-leave-pve-spectator")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 52 }))
		roomFindUniqueMock.mockResolvedValue({ id: BigInt(101), pve_mode: true, status: 1, bet_amount: 100 })
		roomUserFindManyMock.mockResolvedValue([
			{
				joined_at: new Date("2026-05-26T00:00:00.000Z"),
				team: "red",
				user_id: BigInt(51),
				users: { id: BigInt(51), display_name: "Player A", avatar_seq: 0, is_bot: false }
			},
			{
				joined_at: new Date("2026-05-26T00:00:01.000Z"),
				team: "black",
				user_id: BigInt(999),
				users: { id: BigInt(999), display_name: "Bot", avatar_seq: 0, is_bot: true }
			},
			{
				joined_at: new Date("2026-05-26T00:00:02.000Z"),
				team: null,
				user_id: BigInt(52),
				users: { id: BigInt(52), display_name: "Spectator", avatar_seq: 1, is_bot: false }
			}
		])
		roomUserCountMock.mockResolvedValue(2)
		roomUserDeleteManyMock.mockResolvedValue({ count: 1 })

		const res = await request(app)
			.delete(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({ id: 101 })

		expect(res.status).toBe(200)
		expect(roomUserDeleteManyMock).toHaveBeenCalledWith({
			where: { room_id: BigInt(101), user_id: BigInt(52) }
		})
		expect(gameFindFirstMock).not.toHaveBeenCalled()
		expect(gameUpdateMock).not.toHaveBeenCalled()
		expect(releaseEngineMock).not.toHaveBeenCalled()
		expect(roomUpdateMock).not.toHaveBeenCalled()
		expect(emitRoomDeletedMock).not.toHaveBeenCalled()
		expect(emitRoomUsersUpdatedMock).toHaveBeenCalledWith(101, [
			{
				id: 51,
				display_name: "Player A",
				avatar_seq: 0,
				avatar_url: "/images/51.jpg",
				team: "red",
				total_amount: undefined,
				is_bot: false,
				joined_at: new Date("2026-05-26T00:00:00.000Z")
			},
			{
				id: 999,
				display_name: "Bot",
				avatar_seq: 0,
				avatar_url: "/images/999.jpg",
				team: "black",
				total_amount: undefined,
				is_bot: true,
				joined_at: new Date("2026-05-26T00:00:01.000Z")
			}
		])
	})

	it("on PvE leave: still deactivates room when no active game exists", async () => {
		const accessToken = buildAccessToken(51, "session-leave-pve-nogame")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 51 }))
		roomFindUniqueMock.mockResolvedValue({ id: BigInt(101), pve_mode: true, status: 1, bet_amount: 100 })
		roomUserFindManyMock.mockResolvedValue([
			{
				joined_at: new Date("2026-05-26T00:00:00.000Z"),
				team: "red",
				user_id: BigInt(51),
				users: {
					id: BigInt(51),
					display_name: "Player A",
					avatar_seq: 0
				}
			},
			{
				joined_at: new Date("2026-05-26T00:00:01.000Z"),
				team: "black",
				user_id: BigInt(999),
				users: {
					id: BigInt(999),
					display_name: "Bot",
					avatar_seq: 0
				}
			}
		])
		gameFindFirstMock.mockResolvedValue(null)
		roomUserDeleteManyMock.mockResolvedValue({ count: 2 })
		roomUpdateMock.mockResolvedValue({ id: BigInt(101), is_active: false })

		const res = await request(app)
			.delete(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({ id: 101 })

		expect(res.status).toBe(200)
		expect(gameFindFirstMock).toHaveBeenCalledWith({
			where: { room_id: BigInt(101), status: 1 },
			select: { id: true }
		})
		expect(gameUpdateMock).not.toHaveBeenCalled()
		expect(releaseEngineMock).not.toHaveBeenCalled()
		expect(roomUpdateMock).toHaveBeenCalledWith({
			where: { id: BigInt(101) },
			data: { is_active: false }
		})
		expect(emitRoomDeletedMock).toHaveBeenCalledWith(101)
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
