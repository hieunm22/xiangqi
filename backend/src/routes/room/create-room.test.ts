import express from "express"
import jwt from "jsonwebtoken"
import request from "supertest"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"

const redisGetMock = vi.fn()
const roomUserDeleteManyMock = vi.fn()
const roomCreateMock = vi.fn()
const emitRoomCreatedMock = vi.fn()

const BOT_USER_ID = 0n
const PATH = "/api/room/create-room"

vi.mock("../../common/redis", () => ({
	default: {
		get: redisGetMock
	}
}))

vi.mock("prisma", () => ({
	default: {
		roomUser: {
			deleteMany: roomUserDeleteManyMock
		},
		room: {
			create: roomCreateMock
		}
	}
}))

vi.mock("common/socket", () => ({
	emitRoomCreated: emitRoomCreatedMock
}))

// Pin the bot id so the create-call args (which use the real BOT_USER_ID from
// create-room.ts) stay consistent with the response-side fixtures below. Must be
// an inline literal — vi.mock is hoisted above the BOT_USER_ID const.
vi.mock("common/bot-engine", () => ({
	BOT_USER_ID: 0n
}))

describe("POST /api/room/create-room", () => {
	let app: express.Express
	let consoleErrorSpy: ReturnType<typeof vi.spyOn>

	beforeAll(async () => {
		process.env.JWT_SECRET = "unit-test-secret"
		process.env.JWT_ISSUER = "unit-test-issuer"

		const { default: createRoomRoutes } = await import("./create-room")
		app = express()
		app.use(express.json())
		app.use("/api", createRoomRoutes)
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
		const res = await request(app).post(PATH).send({
			tableName: "Table 1",
			teamName: "red",
			redFirst: true,
			betAmount: 10
		})

		expect(res.status).toBe(401)
		expect(res.body).toMatchObject({
			success: false,
			message: "auth-middleware.messages.token-required",
			status_code: 401
		})
	})

	it("returns 400 when tableName is missing", async () => {
		const accessToken = buildAccessToken(11, "session-room-2")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 11 }))

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({
				tableName: "",
				teamName: "red",
				redFirst: true,
				betAmount: 10
			})

		expect(res.status).toBe(400)
		expect(res.body).toMatchObject({
			success: false,
			message: "create-room.messages.name-required",
			status_code: 400
		})
		expect(roomUserDeleteManyMock).not.toHaveBeenCalled()
	})

	it("returns 400 when teamName is invalid", async () => {
		const accessToken = buildAccessToken(11, "session-room-3")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 11 }))

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({
				tableName: "Table 1",
				teamName: "blue",
				redFirst: true,
				betAmount: 10
			})

		expect(res.status).toBe(400)
		expect(res.body).toMatchObject({
			success: false,
			message: "create-room.messages.invalid-team-name",
			status_code: 400
		})
	})

	it("returns 201 when teamName is null", async () => {
		const accessToken = buildAccessToken(11, "session-room-3-null")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 11 }))
		roomUserDeleteManyMock.mockResolvedValue({ count: 1 })
		roomCreateMock.mockResolvedValue({
			id: BigInt(102),
			name: "Table Null Team",
			status: 1,
			red_first: false,
			pve_mode: false,
			bet_amount: 20,
			host_id: BigInt(11),
			created_at: new Date("2026-05-12T00:00:00.000Z"),
			updated_at: new Date("2026-05-12T00:00:00.000Z"),
			room_users: [
				{
					users: {
						id: BigInt(11),
						display_name: "Alice",
						avatar_seq: 2
					},
					team: null
				}
			]
		})

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({
				tableName: "Table Null Team",
				teamName: null,
				redFirst: false,
				betAmount: 20
			})

		expect(res.status).toBe(201)
		expect(res.body).toMatchObject({
			success: true,
			message: "create-room.messages.room-created",
			status_code: 201,
			data: {
				room: {
					id: 102,
					name: "Table Null Team",
					status: 1,
					red_first: false,
					bet_amount: 20,
					host_id: 11
				}
			}
		})
		expect(res.body.data.users).toHaveLength(1)
		expect(res.body.data.users[0]).toMatchObject({
			id: "11",
			display_name: "Alice",
			team: null,
			avatar_url: "/images/11_2.jpg"
		})
		expect(roomCreateMock).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					name: "Table Null Team",
					red_first: false,
					bet_amount: 20,
					host_id: BigInt(11),
					room_users: {
						create: [
							expect.objectContaining({
								user_id: BigInt(11),
								team: null,
								joined_at: expect.any(Date)
							})
						]
					}
				})
			})
		)
		expect(emitRoomCreatedMock).toHaveBeenCalledWith(
			expect.objectContaining({
				id: 102,
				name: "Table Null Team",
				status: 1
			})
		)
	})

	it("returns 400 when redFirst is not boolean", async () => {
		const accessToken = buildAccessToken(11, "session-room-4")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 11 }))

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({
				tableName: "Table 1",
				teamName: "red",
				redFirst: "true",
				betAmount: 10
			})

		expect(res.status).toBe(400)
		expect(res.body).toMatchObject({
			success: false,
			message: "create-room.messages.invalid-redFirst",
			status_code: 400
		})
	})

	it("returns 400 when betAmount is not acceptable", async () => {
		const accessToken = buildAccessToken(11, "session-room-5")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 11 }))

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({
				tableName: "Table 1",
				teamName: "red",
				redFirst: true,
				betAmount: 15
			})

		expect(res.status).toBe(400)
		expect(res.body).toMatchObject({
			success: false,
			message: "create-room.messages.invalid-bet-amount",
			status_code: 400
		})
	})

	it("returns 400 when betAmount is not a number", async () => {
		const accessToken = buildAccessToken(11, "session-room-5b")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 11 }))

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({
				tableName: "Table 1",
				teamName: "red",
				redFirst: true,
				betAmount: "fifty"
			})

		expect(res.status).toBe(400)
		expect(res.body).toMatchObject({
			success: false,
			message: "create-room.messages.invalid-bet-amount",
			status_code: 400
		})
	})

	it("returns 400 when betAmount is not a number", async () => {
		const accessToken = buildAccessToken(11, "session-room-5c")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 11 }))

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({
				tableName: "Table 1",
				teamName: "red",
				redFirst: true,
				betAmount: "5x"
			})

		expect(res.status).toBe(400)
		expect(res.body).toMatchObject({
			success: false,
			message: "create-room.messages.invalid-bet-amount",
			status_code: 400
		})
	})

	it("returns 201 and creates room successfully", async () => {
		const accessToken = buildAccessToken(11, "session-room-6")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 11 }))
		roomUserDeleteManyMock.mockResolvedValue({ count: 1 })
		roomCreateMock.mockResolvedValue({
			id: BigInt(101),
			name: "Table 1",
			status: 1,
			red_first: true,
			pve_mode: false,
			bet_amount: 50,
			host_id: BigInt(11),
			created_at: new Date("2026-05-12T00:00:00.000Z"),
			updated_at: new Date("2026-05-12T00:00:00.000Z"),
			room_users: [
				{
					users: {
						id: BigInt(11),
						display_name: "Alice",
						avatar_seq: 0
					},
					team: "red"
				}
			]
		})

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({
				tableName: "Table 1",
				teamName: "red",
				redFirst: true,
				betAmount: 50
			})

		expect(res.status).toBe(201)
		expect(res.body).toMatchObject({
			success: true,
			message: "create-room.messages.room-created",
			status_code: 201,
			data: {
				room: {
					id: 101,
					name: "Table 1",
					status: 1,
					red_first: true,
					pve_mode: false,
					bet_amount: 50,
					host_id: 11
				}
			}
		})
		expect(res.body.data.room.room_users).toBeUndefined()
		expect(res.body.data.users).toHaveLength(1)
		expect(res.body.data.users[0]).toMatchObject({
			id: "11",
			display_name: "Alice",
			team: "red",
			avatar_url: "/images/11.jpg"
		})

		expect(roomUserDeleteManyMock).toHaveBeenCalledWith({
			where: { user_id: BigInt(11) }
		})
		expect(roomCreateMock).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					name: "Table 1",
					status: 1,
					red_first: true,
					pve_mode: false,
					bet_amount: 50,
					host_id: BigInt(11),
					room_users: {
						create: [
							expect.objectContaining({
								user_id: BigInt(11),
								team: "red",
								joined_at: expect.any(Date)
							})
						]
					}
				})
			})
		)
	})

	it("returns 201 and creates PvE room successfully", async () => {
		const accessToken = buildAccessToken(11, "session-room-6b")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 11 }))
		roomUserDeleteManyMock.mockResolvedValue({ count: 1 })
		roomCreateMock.mockResolvedValue({
			id: BigInt(102),
			name: "PvE Table",
			status: 1,
			red_first: false,
			pve_mode: true,
			bet_amount: 0,
			host_id: BigInt(11),
			created_at: new Date("2026-05-12T00:00:00.000Z"),
			updated_at: new Date("2026-05-12T00:00:00.000Z"),
			room_users: [
				{
					users: {
						id: BigInt(11),
						display_name: "Alice",
						avatar_seq: 1
					},
					team: "black"
				},
				{
					users: {
						id: BOT_USER_ID,
						display_name: "Bot",
						avatar_seq: 0
					},
					team: "red"
				}
			]
		})

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({
				tableName: "PvE Table",
				teamName: "black",
				redFirst: false,
				pveMode: true,
				betAmount: 0
			})

		expect(roomUserDeleteManyMock).toHaveBeenCalled()
		expect(res.status).toBe(201)
		expect(res.body).toMatchObject({
			success: true,
			message: "create-room.messages.room-created",
			status_code: 201,
			data: {
				room: {
					id: 102,
					name: "PvE Table",
					status: 1,
					red_first: false,
					pve_mode: true,
					bet_amount: 0,
					host_id: 11
				}
			}
		})
		expect(res.body.data.users).toHaveLength(2)
		expect(res.body.data.users[0]).toMatchObject({
			id: "11",
			display_name: "Alice",
			team: "black",
			avatar_url: "/images/11_1.jpg"
		})
		expect(res.body.data.users[1]).toMatchObject({
			id: "0",
			display_name: "Bot",
			team: "red"
		})

		expect(roomCreateMock).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					name: "PvE Table",
					red_first: false,
					pve_mode: true,
					bet_amount: 0,
					host_id: BigInt(11),
					room_users: {
						create: [
							expect.objectContaining({
								user_id: BigInt(11),
								team: "black",
								joined_at: expect.any(Date)
							}),
							expect.objectContaining({
								user_id: BOT_USER_ID,
								team: "red",
								joined_at: expect.any(Date)
							})
						]
					}
				})
			})
		)
	})

	it("returns 400 when PvE mode has non-zero bet amount", async () => {
		const accessToken = buildAccessToken(11, "session-room-7")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 11 }))

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({
				tableName: "PvE Table Invalid",
				teamName: "red",
				redFirst: true,
				pveMode: true,
				betAmount: 50
			})

		expect(res.status).toBe(400)
		expect(res.body).toMatchObject({
			success: false,
			message: "create-room.messages.invalid-bet-amount",
			status_code: 400
		})
	})

	it("returns 201 when PvP mode has zero bet amount", async () => {
		const accessToken = buildAccessToken(11, "session-room-7b")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 11 }))
		roomUserDeleteManyMock.mockResolvedValue({ count: 1 })
		roomCreateMock.mockResolvedValue({
			id: BigInt(103),
			name: "PvP Table Zero",
			status: 1,
			red_first: true,
			pve_mode: false,
			bet_amount: 0,
			created_at: new Date("2026-05-12T00:00:00.000Z"),
			updated_at: new Date("2026-05-12T00:00:00.000Z"),
			room_users: [
				{
					users: {
						id: BigInt(11),
						display_name: "Alice",
						avatar_seq: 1
					},
					team: "red"
				}
			]
		})

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({
				tableName: "PvP Table Zero",
				teamName: "red",
				redFirst: true,
				pveMode: false,
				betAmount: 0
			})

		expect(res.status).toBe(201)
		expect(res.body).toMatchObject({
			success: true,
			message: "create-room.messages.room-created",
			status_code: 201,
			data: {
				room: {
					id: 103,
					name: "PvP Table Zero",
					status: 1,
					red_first: true,
					pve_mode: false,
					bet_amount: 0
				}
			}
		})
		expect(res.body.data.users).toHaveLength(1)
		expect(res.body.data.users[0]).toMatchObject({
			id: "11",
			display_name: "Alice",
			team: "red"
		})

		expect(roomCreateMock).toHaveBeenCalledWith(
			expect.objectContaining({
				data: expect.objectContaining({
					name: "PvP Table Zero",
					red_first: true,
					pve_mode: false,
					bet_amount: 0,
					room_users: {
						create: [
							expect.objectContaining({
								user_id: BigInt(11),
								team: "red",
								joined_at: expect.any(Date)
							})
						]
					}
				})
			})
		)
	})

	it("returns 500 when creating room fails unexpectedly", async () => {
		const accessToken = buildAccessToken(11, "session-room-8")
		consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined)
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 11 }))
		roomUserDeleteManyMock.mockResolvedValue({ count: 1 })
		roomCreateMock.mockRejectedValue(new Error("db down"))

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({
				tableName: "Table 1",
				teamName: "red",
				redFirst: true,
				betAmount: 50
			})

		expect(res.status).toBe(500)
		expect(res.body).toMatchObject({
			success: false,
			message: "create-room.messages.internal-server-error",
			status_code: 500
		})
	})
})