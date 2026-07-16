import express from "express"
import jwt from "jsonwebtoken"
import request from "supertest"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"

const redisGetMock = vi.fn()
const prismaRoomFindUniqueMock = vi.fn()
const prismaRoomUserFindFirstMock = vi.fn()
const prismaRoomUpdateMock = vi.fn()

const PATH = "/api/room/update"

vi.mock("../../common/redis", () => ({
	default: {
		get: redisGetMock
	}
}))

vi.mock("prisma", () => ({
	default: {
		room: {
			findUnique: prismaRoomFindUniqueMock,
			update: prismaRoomUpdateMock
		},
		roomUser: {
			findFirst: prismaRoomUserFindFirstMock
		}
	}
}))

describe("PATCH /api/room/update", () => {
	let app: express.Express
	let consoleErrorSpy: ReturnType<typeof vi.spyOn>

	beforeAll(async () => {
		process.env.JWT_SECRET = "unit-test-secret"
		process.env.JWT_ISSUER = "unit-test-issuer"

		const { default: updateRoomRoutes } = await import("./update-room")
		app = express()
		app.use(express.json())
		app.use("/api", updateRoomRoutes)
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
		const res = await request(app).patch(PATH).send({
			id: 1,
			name: "New Room Name"
		})

		expect(res.status).toBe(401)
		expect(res.body).toMatchObject({
			success: false,
			message: "auth-middleware.messages.token-required",
			status_code: 401
		})
	})

	it("returns 400 when id is missing", async () => {
		const accessToken = buildAccessToken(11, "session-room-1")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 11 }))

		const res = await request(app)
			.patch(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({
				name: "New Room Name"
			})

		expect(res.status).toBe(400)
		expect(res.body).toMatchObject({
			success: false,
			message: "update-room.messages.invalid-room-id",
			status_code: 400
		})
	})

	it("returns 400 when id is not an integer", async () => {
		const accessToken = buildAccessToken(11, "session-room-2")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 11 }))

		const res = await request(app)
			.patch(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({
				id: "not-a-number",
				name: "New Room Name"
			})

		expect(res.status).toBe(400)
		expect(res.body).toMatchObject({
			success: false,
			message: "update-room.messages.invalid-room-id",
			status_code: 400
		})
	})

	it("returns 400 when id is less than or equal to 0", async () => {
		const accessToken = buildAccessToken(11, "session-room-3")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 11 }))

		const res = await request(app)
			.patch(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({
				id: 0,
				name: "New Room Name"
			})

		expect(res.status).toBe(400)
		expect(res.body).toMatchObject({
			success: false,
			message: "update-room.messages.invalid-room-id",
			status_code: 400
		})
	})

	it("returns 400 when id is negative", async () => {
		const accessToken = buildAccessToken(11, "session-room-4")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 11 }))

		const res = await request(app)
			.patch(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({
				id: -5,
				name: "New Room Name"
			})

		expect(res.status).toBe(400)
		expect(res.body).toMatchObject({
			success: false,
			message: "update-room.messages.invalid-room-id",
			status_code: 400
		})
	})

	it("returns 400 when name is missing", async () => {
		const accessToken = buildAccessToken(11, "session-room-5")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 11 }))

		const res = await request(app)
			.patch(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({
				id: 1
			})

		expect(res.status).toBe(400)
		expect(res.body).toMatchObject({
			success: false,
			message: "update-room.messages.name-required",
			status_code: 400
		})
	})

	it("returns 400 when name is empty string", async () => {
		const accessToken = buildAccessToken(11, "session-room-6")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 11 }))

		const res = await request(app)
			.patch(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({
				id: 1,
				name: ""
			})

		expect(res.status).toBe(400)
		expect(res.body).toMatchObject({
			success: false,
			message: "update-room.messages.name-required",
			status_code: 400
		})
	})

	it("returns 400 when name is whitespace only", async () => {
		const accessToken = buildAccessToken(11, "session-room-7")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 11 }))

		const res = await request(app)
			.patch(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({
				id: 1,
				name: "   "
			})

		expect(res.status).toBe(400)
		expect(res.body).toMatchObject({
			success: false,
			message: "update-room.messages.name-required",
			status_code: 400
		})
	})

	it("returns 400 when name is not a string", async () => {
		const accessToken = buildAccessToken(11, "session-room-8")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 11 }))

		const res = await request(app)
			.patch(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({
				id: 1,
				name: 12345
			})

		expect(res.status).toBe(400)
		expect(res.body).toMatchObject({
			success: false,
			message: "update-room.messages.name-required",
			status_code: 400
		})
	})

	it("returns 404 when room does not exist", async () => {
		const accessToken = buildAccessToken(11, "session-room-9")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 11 }))
		prismaRoomFindUniqueMock.mockResolvedValue(null)

		const res = await request(app)
			.patch(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({
				id: 999,
				name: "New Room Name"
			})

		expect(res.status).toBe(404)
		expect(res.body).toMatchObject({
			success: false,
			message: "update-room.messages.room-not-found",
			status_code: 404
		})
		expect(prismaRoomFindUniqueMock).toHaveBeenCalledWith({
			where: { id: BigInt(999) },
			select: { id: true, host_id: true }
		})
	})

	it("returns 403 when user is not the room host", async () => {
		const accessToken = buildAccessToken(11, "session-room-10")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 11 }))
		prismaRoomFindUniqueMock.mockResolvedValue({
			id: BigInt(1),
			host_id: BigInt(22) // Different user is the host
		})

		const res = await request(app)
			.patch(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({
				id: 1,
				name: "New Room Name"
			})

		expect(res.status).toBe(403)
		expect(res.body).toMatchObject({
			success: false,
			message: "update-room.messages.forbidden",
			status_code: 403
		})
	})

	it("returns 403 when room has no host (edge case)", async () => {
		const accessToken = buildAccessToken(11, "session-room-11")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 11 }))
		prismaRoomFindUniqueMock.mockResolvedValue({
			id: BigInt(1),
			host_id: null
		})

		const res = await request(app)
			.patch(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({
				id: 1,
				name: "New Room Name"
			})

		expect(res.status).toBe(403)
		expect(res.body).toMatchObject({
			success: false,
			message: "update-room.messages.forbidden",
			status_code: 403
		})
	})

	it("returns 400 when timeLimit is not an accepted value", async () => {
		const accessToken = buildAccessToken(11, "session-room-time-bad")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 11 }))

		const res = await request(app)
			.patch(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({ id: 1, name: "Room", timeLimit: 42 })

		expect(res.status).toBe(400)
		expect(res.body).toMatchObject({
			success: false,
			message: "update-room.messages.invalid-time-limit",
			status_code: 400
		})
		expect(prismaRoomUpdateMock).not.toHaveBeenCalled()
	})

	it("returns 400 when timeIncrement is not an accepted value", async () => {
		const accessToken = buildAccessToken(11, "session-room-inc-bad")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 11 }))

		const res = await request(app)
			.patch(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({ id: 1, name: "Room", timeIncrement: 7 })

		expect(res.status).toBe(400)
		expect(res.body.message).toBe("update-room.messages.invalid-time-increment")
		expect(prismaRoomUpdateMock).not.toHaveBeenCalled()
	})

	it("returns 400 when timePerMove is not an accepted value", async () => {
		const accessToken = buildAccessToken(11, "session-room-pm-bad")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 11 }))

		const res = await request(app)
			.patch(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({ id: 1, name: "Room", timePerMove: 45 })

		expect(res.status).toBe(400)
		expect(res.body.message).toBe("update-room.messages.invalid-time-per-move")
		expect(prismaRoomUpdateMock).not.toHaveBeenCalled()
	})

	it("updates the time limit when the host provides one", async () => {
		const accessToken = buildAccessToken(11, "session-room-time-ok")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 11 }))
		prismaRoomFindUniqueMock.mockResolvedValue({ id: BigInt(1), host_id: BigInt(11) })
		prismaRoomUpdateMock.mockResolvedValue({
			id: BigInt(1),
			name: "Room",
			status: 1,
			red_first: true,
			pve_mode: false,
			bet_amount: 50,
			time_limit: 900
		})

		const res = await request(app)
			.patch(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({ id: 1, name: "Room", timeLimit: 900 })

		expect(res.status).toBe(200)
		expect(res.body.data.room.time_limit).toBe(900)
		expect(prismaRoomUpdateMock).toHaveBeenCalledWith(
			expect.objectContaining({
				data: { name: "Room", time_limit: 900 }
			})
		)
	})

	it("applies the increment and per-move add-ons when the host provides them", async () => {
		const accessToken = buildAccessToken(11, "session-room-time-addons")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 11 }))
		prismaRoomFindUniqueMock.mockResolvedValue({ id: BigInt(1), host_id: BigInt(11) })
		prismaRoomUpdateMock.mockResolvedValue({
			id: BigInt(1),
			name: "Room",
			status: 1,
			red_first: true,
			pve_mode: false,
			bet_amount: 50,
			time_limit: 900,
			time_increment: 5,
			time_per_move: 30
		})

		const res = await request(app)
			.patch(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({ id: 1, name: "Room", timeLimit: 900, timeIncrement: 5, timePerMove: 30 })

		expect(res.status).toBe(200)
		expect(res.body.data.room).toMatchObject({
			time_limit: 900,
			time_increment: 5,
			time_per_move: 30
		})
		// A total limit is set, so the add-ons are applied (not force-cleared).
		expect(prismaRoomUpdateMock).toHaveBeenCalledWith(
			expect.objectContaining({
				data: { name: "Room", time_limit: 900, time_increment: 5, time_per_move: 30 }
			})
		)
	})

	it("clears the time limit when the host passes null", async () => {
		const accessToken = buildAccessToken(11, "session-room-time-null")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 11 }))
		prismaRoomFindUniqueMock.mockResolvedValue({ id: BigInt(1), host_id: BigInt(11) })
		prismaRoomUpdateMock.mockResolvedValue({
			id: BigInt(1),
			name: "Room",
			status: 1,
			red_first: true,
			pve_mode: false,
			bet_amount: 50,
			time_limit: null
		})

		const res = await request(app)
			.patch(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({ id: 1, name: "Room", timeLimit: null })

		expect(res.status).toBe(200)
		expect(prismaRoomUpdateMock).toHaveBeenCalledWith(
			expect.objectContaining({
				data: { name: "Room", time_limit: null, time_increment: 0, time_per_move: 0 }
			})
		)
	})

	it("returns 200 and updates room when user is the host", async () => {
		const accessToken = buildAccessToken(11, "session-room-12")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 11 }))
		prismaRoomFindUniqueMock.mockResolvedValue({
			id: BigInt(1),
			host_id: BigInt(11) // Same user is the host
		})
		prismaRoomUpdateMock.mockResolvedValue({
			id: BigInt(1),
			name: "New Room Name",
			status: 1,
			red_first: true,
			pve_mode: false,
			bet_amount: 50
		})

		const res = await request(app)
			.patch(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({
				id: 1,
				name: "New Room Name"
			})

		expect(res.status).toBe(200)
		expect(res.body).toMatchObject({
			success: true,
			message: "update-room.messages.success",
			status_code: 200,
			data: {
				room: {
					id: 1,
					name: "New Room Name",
					status: 1,
					red_first: true,
					pve_mode: false,
					bet_amount: 50
				}
			}
		})
		expect(prismaRoomUpdateMock).toHaveBeenCalledWith({
			where: { id: BigInt(1) },
			data: { name: "New Room Name" },
			select: {
				id: true,
				name: true,
				status: true,
				red_first: true,
				pve_mode: true,
				bet_amount: true,
				time_limit: true,
				time_increment: true,
				time_per_move: true
			}
		})
	})

	it("trims whitespace from room name", async () => {
		const accessToken = buildAccessToken(11, "session-room-13")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 11 }))
		prismaRoomFindUniqueMock.mockResolvedValue({
			id: BigInt(1),
			host_id: BigInt(11)
		})
		prismaRoomUpdateMock.mockResolvedValue({
			id: BigInt(1),
			name: "Trimmed Room",
			status: 1,
			red_first: true,
			pve_mode: false,
			bet_amount: 50
		})

		const res = await request(app)
			.patch(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({
				id: 1,
				name: "  Trimmed Room  "
			})

		expect(res.status).toBe(200)
		expect(res.body.data.room.name).toBe("Trimmed Room")
		expect(prismaRoomUpdateMock).toHaveBeenCalledWith({
			where: { id: BigInt(1) },
			data: { name: "Trimmed Room" },
			select: {
				id: true,
				name: true,
				status: true,
				red_first: true,
				pve_mode: true,
				bet_amount: true,
				time_limit: true,
				time_increment: true,
				time_per_move: true
			}
		})
	})

	it("returns 500 when database update fails", async () => {
		const accessToken = buildAccessToken(11, "session-room-14")
		consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined)
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 11 }))
		prismaRoomFindUniqueMock.mockResolvedValue({
			id: BigInt(1),
			host_id: BigInt(11)
		})
		prismaRoomUpdateMock.mockRejectedValue(new Error("database error"))

		const res = await request(app)
			.patch(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({
				id: 1,
				name: "New Room Name"
			})

		expect(res.status).toBe(500)
		expect(res.body).toMatchObject({
			success: false,
			message: "update-room.messages.internal-server-error",
			status_code: 500
		})
		expect(consoleErrorSpy).toHaveBeenCalledWith(
			"[update-room] Error:",
			expect.any(Error)
		)
	})

	it("returns 500 when room lookup fails", async () => {
		const accessToken = buildAccessToken(11, "session-room-15")
		consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined)
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 11 }))
		prismaRoomFindUniqueMock.mockRejectedValue(new Error("database error"))

		const res = await request(app)
			.patch(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({
				id: 1,
				name: "New Room Name"
			})

		expect(res.status).toBe(500)
		expect(res.body).toMatchObject({
			success: false,
			message: "update-room.messages.internal-server-error",
			status_code: 500
		})
	})

	it("converts large room id correctly", async () => {
		const accessToken = buildAccessToken(11, "session-room-16")
		const largeId = 9007199254740991 // Max safe integer
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 11 }))
		prismaRoomFindUniqueMock.mockResolvedValue({
			id: BigInt(largeId),
			host_id: BigInt(11)
		})
		prismaRoomUpdateMock.mockResolvedValue({
			id: BigInt(largeId),
			name: "Large ID Room",
			status: 1,
			red_first: true,
			pve_mode: false,
			bet_amount: 50
		})

		const res = await request(app)
			.patch(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({
				id: largeId,
				name: "Large ID Room"
			})

		expect(res.status).toBe(200)
		expect(res.body.data.room.id).toBe(largeId)
	})

	it("handles special characters in room name", async () => {
		const accessToken = buildAccessToken(11, "session-room-17")
		const specialName = "Room@123#with$Special%Chars"
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 11 }))
		prismaRoomFindUniqueMock.mockResolvedValue({
			id: BigInt(1),
			host_id: BigInt(11)
		})
		prismaRoomUpdateMock.mockResolvedValue({
			id: BigInt(1),
			name: specialName,
			status: 1,
			red_first: true,
			pve_mode: false,
			bet_amount: 50
		})

		const res = await request(app)
			.patch(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({
				id: 1,
				name: specialName
			})

		expect(res.status).toBe(200)
		expect(res.body.data.room.name).toBe(specialName)
	})

	it("handles unicode characters in room name", async () => {
		const accessToken = buildAccessToken(11, "session-room-18")
		const unicodeName = "Phòng chơi 象棋 🎮"
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 11 }))
		prismaRoomFindUniqueMock.mockResolvedValue({
			id: BigInt(1),
			host_id: BigInt(11)
		})
		prismaRoomUpdateMock.mockResolvedValue({
			id: BigInt(1),
			name: unicodeName,
			status: 1,
			red_first: true,
			pve_mode: false,
			bet_amount: 50
		})

		const res = await request(app)
			.patch(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({
				id: 1,
				name: unicodeName
			})

		expect(res.status).toBe(200)
		expect(res.body.data.room.name).toBe(unicodeName)
	})
})
