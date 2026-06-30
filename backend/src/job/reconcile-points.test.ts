import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

const groupByMock = vi.fn()
const userFindManyMock = vi.fn()
const userUpdateMock = vi.fn()
const scheduleMock = vi.fn()

vi.mock("prisma", () => ({
	default: {
		gameUser: { groupBy: groupByMock },
		user: { findMany: userFindManyMock, update: userUpdateMock }
	}
}))

vi.mock("node-cron", () => ({
	default: { schedule: scheduleMock }
}))

// Imported dynamically so the vi.mock factories (which close over the mock consts)
// run only after those consts are initialized.
let reconcilePoints: typeof import("./reconcile-points").reconcilePoints
let startPointsReconciler: typeof import("./reconcile-points").startPointsReconciler
let POINTS_RECONCILE_CRON: typeof import("./reconcile-points").POINTS_RECONCILE_CRON

describe("reconcilePoints", () => {
	let warnSpy: ReturnType<typeof vi.spyOn>
	let logSpy: ReturnType<typeof vi.spyOn>

	beforeAll(async () => {
		;({ reconcilePoints, startPointsReconciler, POINTS_RECONCILE_CRON } = await import("./reconcile-points"))
	})

	beforeEach(() => {
		warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined)
		logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined)
	})

	it("flags a mismatch but does not write when autofix is off", async () => {
		// User 11: ledger sum +50 -> correct 250, but cache says 200.
		groupByMock.mockResolvedValue([{ user_id: BigInt(11), _sum: { point: 50 } }])
		userFindManyMock.mockResolvedValue([{ id: BigInt(11), total_amount: 200 }])

		const result = await reconcilePoints({ autofix: false })

		expect(result).toEqual({
			checked: 1,
			fixed: 0,
			mismatches: [{ userId: "11", stored: 200, correct: 250, diff: 50 }]
		})
		expect(userUpdateMock).not.toHaveBeenCalled()
		expect(warnSpy).toHaveBeenCalled()
	})

	it("writes the corrected total_amount when autofix is on", async () => {
		groupByMock.mockResolvedValue([{ user_id: BigInt(11), _sum: { point: 50 } }])
		userFindManyMock.mockResolvedValue([{ id: BigInt(11), total_amount: 200 }])
		userUpdateMock.mockResolvedValue({})

		const result = await reconcilePoints({ autofix: true })

		expect(result.fixed).toBe(1)
		expect(userUpdateMock).toHaveBeenCalledWith({
			where: { id: BigInt(11) },
			data: { total_amount: 250 }
		})
	})

	it("reports no mismatch when the cache already equals the ledger", async () => {
		groupByMock.mockResolvedValue([{ user_id: BigInt(11), _sum: { point: 50 } }])
		userFindManyMock.mockResolvedValue([{ id: BigInt(11), total_amount: 250 }])

		const result = await reconcilePoints({ autofix: true })

		expect(result.mismatches).toHaveLength(0)
		expect(userUpdateMock).not.toHaveBeenCalled()
	})

	it("treats a user with no ledger entries as the initial 200 points", async () => {
		// No groupBy row for the user -> sum defaults to 0 -> correct = 200.
		groupByMock.mockResolvedValue([])
		userFindManyMock.mockResolvedValue([{ id: BigInt(11), total_amount: 200 }])

		const result = await reconcilePoints({ autofix: true })

		expect(result.mismatches).toHaveLength(0)
		expect(userUpdateMock).not.toHaveBeenCalled()
	})

	it("only considers real users (excludes bots)", async () => {
		groupByMock.mockResolvedValue([])
		userFindManyMock.mockResolvedValue([])

		await reconcilePoints()

		expect(userFindManyMock).toHaveBeenCalledWith({
			where: { is_bot: false },
			select: { id: true, total_amount: true }
		})
		expect(groupByMock).toHaveBeenCalledWith(
			expect.objectContaining({ where: { point: { not: null } } })
		)
	})

	it("scopes both queries to multiple users when userIds are given", async () => {
		groupByMock.mockResolvedValue([
			{ user_id: BigInt(11), _sum: { point: -30 } },
			{ user_id: BigInt(12), _sum: { point: 50 } }
		])
		userFindManyMock.mockResolvedValue([
			{ id: BigInt(11), total_amount: 200 },
			{ id: BigInt(12), total_amount: 200 }
		])
		userUpdateMock.mockResolvedValue({})

		const result = await reconcilePoints({ autofix: true, userIds: [BigInt(11), BigInt(12)] })

		expect(groupByMock).toHaveBeenCalledWith(
			expect.objectContaining({ where: { point: { not: null }, user_id: { in: [BigInt(11), BigInt(12)] } } })
		)
		expect(userFindManyMock).toHaveBeenCalledWith({
			where: { is_bot: false, id: { in: [BigInt(11), BigInt(12)] } },
			select: { id: true, total_amount: true }
		})
		expect(result.checked).toBe(2)
		expect(result.mismatches).toEqual([
			{ userId: "11", stored: 200, correct: 170, diff: -30 },
			{ userId: "12", stored: 200, correct: 250, diff: 50 }
		])
	})

	it("schedules the weekly reconciliation at 23:00 UTC on Sundays", () => {
		startPointsReconciler()

		expect(POINTS_RECONCILE_CRON).toBe("0 23 * * 0")
		expect(scheduleMock).toHaveBeenCalledWith(
			"0 23 * * 0",
			expect.any(Function),
			expect.objectContaining({ timezone: "Etc/UTC" })
		)
	})
})
