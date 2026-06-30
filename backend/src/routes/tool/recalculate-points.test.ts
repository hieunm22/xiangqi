import express from "express"
import request from "supertest"
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

const reconcilePointsMock = vi.fn()

vi.mock("job/reconcile-points", () => ({
	reconcilePoints: reconcilePointsMock
}))

const PATH = "/api/tool/recalculate-points"

describe("POST /api/tool/recalculate-points", () => {
	let app: express.Express
	let consoleErrorSpy: ReturnType<typeof vi.spyOn>

	beforeAll(async () => {
		const { default: recalculatePointsRoutes } = await import("./recalculate-points")
		app = express()
		app.use(express.json())
		app.use("/api", recalculatePointsRoutes)
	})

	afterEach(() => {
		vi.clearAllMocks()
		consoleErrorSpy?.mockRestore()
	})

	it("reconciles all users when no userIds is provided", async () => {
		reconcilePointsMock.mockResolvedValue({ checked: 3, fixed: 1, mismatches: [] })

		const res = await request(app).post(PATH).send({})

		expect(res.status).toBe(200)
		expect(reconcilePointsMock).toHaveBeenCalledWith({ autofix: true, userIds: undefined })
		expect(res.body).toMatchObject({
			success: true,
			message: "recalculate-points.messages.success",
			status_code: 200,
			data: { checked: 3, fixed: 1, mismatches: [] }
		})
	})

	it("reconciles specific users when userIds array is provided", async () => {
		reconcilePointsMock.mockResolvedValue({
			checked: 1,
			fixed: 1,
			mismatches: [{ userId: "11", stored: 200, correct: 250, diff: 50 }]
		})

		const res = await request(app).post(PATH).send({ userIds: [11] })

		expect(res.status).toBe(200)
		expect(reconcilePointsMock).toHaveBeenCalledWith({ autofix: true, userIds: [BigInt(11)] })
		expect(res.body.data.fixed).toBe(1)
	})

	it("returns 400 when userIds contains invalid values", async () => {
		const res = await request(app).post(PATH).send({ userIds: [-5] })

		expect(res.status).toBe(400)
		expect(res.body).toMatchObject({
			success: false,
			message: "recalculate-points.messages.invalid-user-id",
			status_code: 400
		})
		expect(reconcilePointsMock).not.toHaveBeenCalled()
	})

	it("returns 500 when reconciliation throws", async () => {
		consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined)
		reconcilePointsMock.mockRejectedValue(new Error("db down"))

		const res = await request(app).post(PATH).send({})

		expect(res.status).toBe(500)
		expect(res.body).toMatchObject({
			success: false,
			message: "recalculate-points.messages.internal-server-error",
			status_code: 500
		})
	})
})
