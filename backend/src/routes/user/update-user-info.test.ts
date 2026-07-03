import express from "express"
import jwt from "jsonwebtoken"
import request from "supertest"
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"

const redisGetMock = vi.fn()
const uploadBufferToS3Mock = vi.fn()
const userUpdateMock = vi.fn()
const userFindUniqueMock = vi.fn()

const PATH = "/api/user/update-info"

vi.mock("../../common/redis", () => ({
	default: {
		get: redisGetMock
	}
}))

vi.mock("prisma", () => ({
	default: {
		user: {
			findUnique: userFindUniqueMock,
			update: userUpdateMock,
		}
	}
}))

vi.mock("../../common/s3", () => ({
	uploadBufferToS3: uploadBufferToS3Mock
}))

describe("PATCH /api/user/update-info", () => {
	let app: express.Express
	let consoleErrorSpy: ReturnType<typeof vi.spyOn>

	beforeAll(async () => {
		process.env.JWT_SECRET = "unit-test-secret"
		process.env.JWT_ISSUER = "unit-test-issuer"

		const { default: updateUserInfoRoutes } = await import("./update-user-info")
		app = express()
		app.use(express.json())
		app.use("/api", updateUserInfoRoutes)
	})

	afterEach(() => {
		vi.clearAllMocks()
		consoleErrorSpy?.mockRestore()
			uploadBufferToS3Mock.mockResolvedValue(undefined)
			userFindUniqueMock.mockResolvedValue({ avatar_seq: 0 })
	})

	const buildAccessToken = (userId: number, sessionId: string) =>
		jwt.sign({ sub: userId, jti: sessionId }, process.env.JWT_SECRET as string, {
			issuer: process.env.JWT_ISSUER,
			expiresIn: "1h"
		})

	it("returns 401 when authorization token is missing", async () => {
		const res = await request(app).patch(PATH).send({ display_name: "New Name" })

		expect(res.status).toBe(401)
		expect(res.body).toMatchObject({
			success: false,
			message: "auth-middleware.messages.token-required",
			status_code: 401
		})
		expect(userUpdateMock).not.toHaveBeenCalled()
		expect(userFindUniqueMock).not.toHaveBeenCalled()
	})

	it("returns 400 when body has no updatable fields", async () => {
		const accessToken = buildAccessToken(1, "session-update-info-1")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 1 }))

		const res = await request(app)
			.patch(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({})

		expect(res.status).toBe(400)
		expect(res.body).toMatchObject({
			success: false,
			message: "At least one field is required",
			status_code: 400
		})
		expect(userUpdateMock).not.toHaveBeenCalled()
		expect(userFindUniqueMock).not.toHaveBeenCalled()
	})

	it("returns 400 when display_name is empty", async () => {
		const accessToken = buildAccessToken(2, "session-update-info-2")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 2 }))

		const res = await request(app)
			.patch(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({ display_name: "   " })

		expect(res.status).toBe(400)
		expect(res.body).toMatchObject({
			success: false,
			message: "display_name cannot be empty",
			status_code: 400
		})
		expect(userUpdateMock).not.toHaveBeenCalled()
		expect(userFindUniqueMock).not.toHaveBeenCalled()
	})

	it("returns 400 when email is invalid", async () => {
		const accessToken = buildAccessToken(3, "session-update-info-3")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 3 }))

		const res = await request(app)
			.patch(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({ email: "invalid-email" })

		expect(res.status).toBe(400)
		expect(res.body).toMatchObject({
			success: false,
			message: "Invalid email format",
			status_code: 400
		})
		expect(userUpdateMock).not.toHaveBeenCalled()
		expect(userFindUniqueMock).not.toHaveBeenCalled()
	})

	it("returns 409 when email already exists", async () => {
		const accessToken = buildAccessToken(4, "session-update-info-4")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 4 }))
		userUpdateMock.mockRejectedValue({
			code: "P2002",
			meta: { target: ["email"] }
		})

		const res = await request(app)
			.patch(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({ email: "exists@example.com" })

		expect(res.status).toBe(409)
		expect(res.body).toMatchObject({
			success: false,
			message: "Email already exists",
			status_code: 409
		})
	})

	it("updates display_name and returns updated fields", async () => {
		const accessToken = buildAccessToken(5, "session-update-info-5")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 5 }))
		userUpdateMock.mockResolvedValue({
			display_name: "New Display Name",
			email: "user@example.com",
			avatar_seq: 0
		})

		const res = await request(app)
			.patch(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({ display_name: "  New Display Name  " })

		expect(res.status).toBe(200)
		expect(res.body).toMatchObject({
			success: true,
			message: "Success",
			status_code: 200,
			data: {
				display_name: "New Display Name",
				email: "user@example.com",
				avatar_url: "/images/5.jpg"
			}
		})
		expect(userFindUniqueMock).toHaveBeenCalledWith({
			where: { id: BigInt(5) },
			select: { avatar_seq: true }
		})
		expect(userUpdateMock).toHaveBeenCalledWith({
			where: { id: BigInt(5) },
			data: { display_name: "New Display Name" },
			select: {
				display_name: true,
				email: true,
				avatar_seq: true,
			}
		})
	})

	it("updates both display_name and email", async () => {
		const accessToken = buildAccessToken(6, "session-update-info-6")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 6 }))
		userUpdateMock.mockResolvedValue({
			display_name: "Updated User",
			email: "updated@example.com",
			avatar_seq: 0
		})

		const res = await request(app)
			.patch(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({
				display_name: "Updated User",
				email: "Updated@Example.com"
			})

		expect(res.status).toBe(200)
		expect(res.body.data).toMatchObject({
			display_name: "Updated User",
			email: "updated@example.com",
			avatar_url: "/images/6.jpg"
		})
		expect(userUpdateMock).toHaveBeenCalledWith({
			where: { id: BigInt(6) },
			data: {
				display_name: "Updated User",
				email: "updated@example.com"
			},
			select: {
				display_name: true,
				email: true,
				avatar_seq: true,
			}
		})
	})

	it("updates avatar by uploading to s3 and incrementing avatar_seq", async () => {
		const accessToken = buildAccessToken(8, "session-update-info-8")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 8 }))
		userFindUniqueMock.mockResolvedValue({ avatar_seq: 2 })
		userUpdateMock.mockResolvedValue({
			display_name: "User 8",
			email: "user8@example.com",
			avatar_seq: 3
		})

		const res = await request(app)
			.patch(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.attach("avatar", Buffer.from("fake-image-data"), {
				filename: "avatar.jpg",
				contentType: "image/jpeg"
			})

		expect(res.status).toBe(200)
		expect(uploadBufferToS3Mock).toHaveBeenCalledWith(
			"caa-storage",
			"images/8_3.jpg",
			expect.any(Buffer),
			"image/jpeg"
		)
		expect(userUpdateMock).toHaveBeenCalledWith({
			where: { id: BigInt(8) },
			data: { avatar_seq: 3 },
			select: {
				display_name: true,
				email: true,
				avatar_seq: true,
			}
		})
		expect(res.body.data).toMatchObject({
			display_name: "User 8",
			email: "user8@example.com",
			avatar_url: "/images/8_3.jpg"
		})
	})

	it("returns 500 on unexpected error", async () => {
		const accessToken = buildAccessToken(7, "session-update-info-7")
		redisGetMock.mockResolvedValue(JSON.stringify({ userId: 7 }))
		consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
		userUpdateMock.mockRejectedValue(new Error("DB down"))

		const res = await request(app)
			.patch(PATH)
			.set("Authorization", `Bearer ${accessToken}`)
			.send({ display_name: "Any Name" })

		expect(res.status).toBe(500)
		expect(res.body).toMatchObject({
			success: false,
			message: "Internal server error",
			status_code: 500
		})
		expect(consoleErrorSpy).toHaveBeenCalledWith("Update user info error:", expect.any(Error))
	})
})
