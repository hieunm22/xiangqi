import express from "express"
import jwt from "jsonwebtoken"
import request from "supertest"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"

const redisGetMock = vi.fn()
const announcementReadUpsertMock = vi.fn()

const PATH = "/api/message/mark-announcement-as-read"

vi.mock("../../common/redis", () => ({
	default: {
		get: redisGetMock
	}
}))

vi.mock("prisma", () => ({
	default: {
		userAnnouncementRead: {
			upsert: announcementReadUpsertMock
		}
	}
}))

describe("POST /api/message/mark-announcement-as-read", () => {
	let app: express.Express
	let consoleErrorSpy: ReturnType<typeof vi.spyOn>

	beforeAll(async () => {
		process.env.JWT_SECRET = "unit-test-secret"
		process.env.JWT_ISSUER = "unit-test-issuer"

		const { default: markAnnouncementAsReadRoutes } = await import("./mark-announcement-as-read")
		app = express()
		app.use(express.json())
		app.use("/api", markAnnouncementAsReadRoutes)
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
		const res = await request(app).post(PATH)

		expect(res.status).toBe(401)
		expect(res.body).toMatchObject({
			success: false,
			message: "auth-middleware.messages.token-required",
			status_code: 401
		})
		expect(announcementReadUpsertMock).not.toHaveBeenCalled()
	})

	it("returns 200 and upserts the access record for the current session", async () => {
		const accessToken = buildAccessToken(82, "session-mark-announcement-1")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 82 }))

		const readAt = new Date("2026-06-19T05:07:22.194Z")
		announcementReadUpsertMock.mockResolvedValue({ read_announcement_at: readAt })

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)

		expect(res.status).toBe(200)
		expect(announcementReadUpsertMock).toHaveBeenCalledWith({
			where: {
				user_id_session_id: {
					user_id: 82n,
					session_id: "session-mark-announcement-1"
				}
			},
			create: { user_id: 82n, session_id: "session-mark-announcement-1" },
			update: { read_announcement_at: expect.any(Date) },
			select: { read_announcement_at: true }
		})
		expect(res.body).toMatchObject({
			success: true,
			message: "Announcements marked as read",
			status_code: 200,
			data: {
				read_announcement_at: readAt.toISOString()
			}
		})
	})

	it("returns 500 when the upsert fails", async () => {
		const accessToken = buildAccessToken(1, "session-mark-announcement-2")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 1 }))
		consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined)
		announcementReadUpsertMock.mockRejectedValue(new Error("db down"))

		const res = await request(app)
			.post(PATH)
			.set("Authorization", `Bearer ${accessToken}`)

		expect(res.status).toBe(500)
		expect(res.body).toMatchObject({
			success: false,
			message: "Internal server error",
			status_code: 500
		})
	})
})
