import express from "express"
import request from "supertest"
import { afterEach, describe, expect, it, vi } from "vitest"

const prismaFindUniqueMock = vi.fn()
const redisSetMock = vi.fn()
const sendMailMock = vi.fn()
const readFileSyncMock = vi.fn()
const createTransportMock = vi.fn(() => ({ sendMail: sendMailMock }))

const PATH = "/api/auth/forgot-password"

vi.mock("prisma", () => ({
	default: {
		user: {
			findUnique: prismaFindUniqueMock
		}
	}
}))

vi.mock("../../common/redis", () => ({
	default: {
		set: redisSetMock
	}
}))

vi.mock("nodemailer", () => ({
	default: {
		createTransport: createTransportMock
	}
}))

vi.mock("fs", () => ({
	default: {
		readFileSync: readFileSyncMock
	}
}))

const buildApp = async (options?: { appEmail?: string; appPassword?: string }) => {
	vi.resetModules()

	process.env.APP_EMAIL = options?.appEmail ?? "noreply@example.com"
	if (typeof options?.appPassword === "string") {
		process.env.GOOGLE_APP_PASSWORD = options.appPassword
	} else {
		delete process.env.GOOGLE_APP_PASSWORD
	}

	const { default: forgotPasswordRoutes } = await import("./forgot-password")
	const app = express()
	app.use(express.json())
	app.use("/api", forgotPasswordRoutes)
	return app
}

describe("POST /api/auth/forgot-password", () => {
	let consoleErrorSpy: ReturnType<typeof vi.spyOn>

	afterEach(() => {
		vi.clearAllMocks()
		consoleErrorSpy?.mockRestore()
	})

	it("returns 400 when email is missing", async () => {
		const app = await buildApp({ appPassword: "mailer-password" })

		const res = await request(app).post(PATH).send({})

		expect(res.status).toBe(400)
		expect(res.body).toMatchObject({
			success: false,
			message: "forgot-password.messages.missing-email",
			status_code: 400
		})
		expect(prismaFindUniqueMock).not.toHaveBeenCalled()
	})

	it("returns 400 when email format is invalid", async () => {
		const app = await buildApp({ appPassword: "mailer-password" })

		const res = await request(app).post(PATH).send({ email: "invalid-email" })

		expect(res.status).toBe(400)
		expect(res.body).toMatchObject({
			success: false,
			message: "forgot-password.messages.invalid-email-format",
			status_code: 400
		})
		expect(prismaFindUniqueMock).not.toHaveBeenCalled()
	})

	it("returns 500 when email service credentials are not configured", async () => {
		consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined)
		const app = await buildApp()

		const res = await request(app).post(PATH).send({ email: "alice@example.com" })

		expect(res.status).toBe(500)
		expect(res.body).toMatchObject({
			success: false,
			message: "forgot-password.messages.email-service-not-configured",
			status_code: 500
		})
		expect(prismaFindUniqueMock).not.toHaveBeenCalled()
	})

	it("returns 409 when email does not exist", async () => {
		const app = await buildApp({ appPassword: "mailer-password" })
		prismaFindUniqueMock.mockResolvedValue(null)

		const res = await request(app).post(PATH).send({ email: "alice@example.com" })

		expect(res.status).toBe(409)
		expect(res.body).toMatchObject({
			success: false,
			message: "forgot-password.messages.email-not-found",
			status_code: 409
		})
		expect(redisSetMock).not.toHaveBeenCalled()
		expect(sendMailMock).not.toHaveBeenCalled()
	})

	it("returns 200 and sends forgot-password email when input is valid", async () => {
		const app = await buildApp({ appPassword: "mailer-password" })
		prismaFindUniqueMock.mockResolvedValue({
			id: 5,
			user_name: "alice",
			display_name: "Alice",
			email: "alice@example.com"
		})
		readFileSyncMock.mockReturnValue(
			"Hello {displayName}. Click {domain}/reset-password/{id}/{token} for {userName}."
		)
		sendMailMock.mockResolvedValue({})

		const res = await request(app)
			.post(PATH)
			.set("Origin", "https://client.example")
			.send({ email: "ALICE@EXAMPLE.COM" })

		expect(res.status).toBe(200)
		expect(res.body).toMatchObject({
			success: true,
			message: "forgot-password.messages.success",
			status_code: 200
		})

		expect(prismaFindUniqueMock).toHaveBeenCalledWith(
			expect.objectContaining({ where: { email: "alice@example.com" } })
		)

		expect(redisSetMock).toHaveBeenCalledTimes(1)
		const [redisKey, forgotGuid, expiryMode, ttl] = redisSetMock.mock.calls[0]
		expect(redisKey).toBe("forgot-password:5")
		expect(typeof forgotGuid).toBe("string")
		expect(forgotGuid.length).toBeGreaterThan(10)
		expect(expiryMode).toBe("EX")
		expect(ttl).toBe(3600)

		expect(sendMailMock).toHaveBeenCalledTimes(1)
		expect(sendMailMock).toHaveBeenCalledWith(
			expect.objectContaining({
				from: "noreply@example.com",
				to: "alice@example.com",
				subject: "Reset Password detail for alice",
				html: expect.stringContaining("Alice")
			})
		)
		const htmlBody = sendMailMock.mock.calls[0][0].html as string
		expect(htmlBody).toContain("https://client.example")
		expect(htmlBody).toContain("alice")
		expect(htmlBody).toContain(String(forgotGuid))
	})

	it("returns 500 when unexpected error happens", async () => {
		consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined)
		const app = await buildApp({ appPassword: "mailer-password" })
		prismaFindUniqueMock.mockRejectedValue(new Error("db down"))

		const res = await request(app).post(PATH).send({ email: "alice@example.com" })

		expect(res.status).toBe(500)
		expect(res.body).toMatchObject({
			success: false,
			message: "forgot-password.messages.internal-server-error",
			status_code: 500
		})
	})
})
