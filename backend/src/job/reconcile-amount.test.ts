import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"

const groupByMock = vi.fn()
const historyGroupByMock = vi.fn()
const userFindManyMock = vi.fn()
const userUpdateMock = vi.fn()
const scheduleMock = vi.fn()

vi.mock("prisma", () => ({
	default: {
		gameUser: { groupBy: groupByMock },
		userAmountHistory: { groupBy: historyGroupByMock },
		user: { findMany: userFindManyMock, update: userUpdateMock }
	}
}))

vi.mock("node-cron", () => ({
	default: { schedule: scheduleMock }
}))

// Imported dynamically so the vi.mock factories (which close over the mock consts)
// run only after those consts are initialized.
let reconcileAmount: typeof import("./reconcile-amount").reconcileAmount
let startAmountReconciler: typeof import("./reconcile-amount").startAmountReconciler
let parseUserIdSpec: typeof import("./reconcile-amount").parseUserIdSpec
let AMOUNT_RECONCILE_CRON: typeof import("./reconcile-amount").AMOUNT_RECONCILE_CRON

describe("reconcileAmount", () => {
	let warnSpy: ReturnType<typeof vi.spyOn>
	let logSpy: ReturnType<typeof vi.spyOn>

	beforeAll(async () => {
		;({ reconcileAmount, startAmountReconciler, parseUserIdSpec, AMOUNT_RECONCILE_CRON } = await import(
			"./reconcile-amount"
		))
	})

	beforeEach(() => {
		warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined)
		logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined)
		// Default: no non-game amount history. Tests that exercise it override this.
		historyGroupByMock.mockResolvedValue([])
	})

	it("flags a mismatch but does not write when autofix is off", async () => {
		// User 11: ledger sum +50 -> correct 250, but cache says 200.
		groupByMock.mockResolvedValue([{ user_id: BigInt(11), _sum: { amount: 50 } }])
		userFindManyMock.mockResolvedValue([{ id: BigInt(11), total_amount: 200 }])

		const result = await reconcileAmount({ autofix: false })

		expect(result).toEqual({
			checked: 1,
			fixed: 0,
			mismatches: [{ userId: "11", stored: 200, correct: 250, diff: 50 }]
		})
		expect(userUpdateMock).not.toHaveBeenCalled()
		expect(warnSpy).toHaveBeenCalled()
	})

	it("writes the corrected total_amount when autofix is on", async () => {
		groupByMock.mockResolvedValue([{ user_id: BigInt(11), _sum: { amount: 50 } }])
		userFindManyMock.mockResolvedValue([{ id: BigInt(11), total_amount: 200 }])
		userUpdateMock.mockResolvedValue({})

		const result = await reconcileAmount({ autofix: true })

		expect(result.fixed).toBe(1)
		expect(userUpdateMock).toHaveBeenCalledWith({
			where: { id: BigInt(11) },
			data: { total_amount: 250 }
		})
	})

	it("reports no mismatch when the cache already equals the ledger", async () => {
		groupByMock.mockResolvedValue([{ user_id: BigInt(11), _sum: { amount: 50 } }])
		userFindManyMock.mockResolvedValue([{ id: BigInt(11), total_amount: 250 }])

		const result = await reconcileAmount({ autofix: true })

		expect(result.mismatches).toHaveLength(0)
		expect(userUpdateMock).not.toHaveBeenCalled()
	})

	it("treats a user with no ledger entries as the initial 200 coins", async () => {
		// No groupBy row for the user -> sum defaults to 0 -> correct = 200.
		groupByMock.mockResolvedValue([])
		userFindManyMock.mockResolvedValue([{ id: BigInt(11), total_amount: 200 }])

		const result = await reconcileAmount({ autofix: true })

		expect(result.mismatches).toHaveLength(0)
		expect(userUpdateMock).not.toHaveBeenCalled()
	})

	it("only considers real users (excludes bots)", async () => {
		groupByMock.mockResolvedValue([])
		userFindManyMock.mockResolvedValue([])

		await reconcileAmount()

		expect(userFindManyMock).toHaveBeenCalledWith({
			where: { is_bot: false },
			select: { id: true, total_amount: true }
		})
		expect(groupByMock).toHaveBeenCalledWith(
			expect.objectContaining({ where: { amount: { not: null } } })
		)
		expect(historyGroupByMock).toHaveBeenCalledWith(
			expect.objectContaining({ where: {} })
		)
	})

	it("adds non-game amount history to the game ledger when computing the correct total", async () => {
		// User 11: game ledger +50, amount history +30 -> correct = 200 + 80 = 280.
		groupByMock.mockResolvedValue([{ user_id: BigInt(11), _sum: { amount: 50 } }])
		historyGroupByMock.mockResolvedValue([{ user_id: BigInt(11), _sum: { amount: 30 } }])
		userFindManyMock.mockResolvedValue([{ id: BigInt(11), total_amount: 250 }])
		userUpdateMock.mockResolvedValue({})

		const result = await reconcileAmount({ autofix: true })

		expect(result.mismatches).toEqual([{ userId: "11", stored: 250, correct: 280, diff: 30 }])
		expect(userUpdateMock).toHaveBeenCalledWith({
			where: { id: BigInt(11) },
			data: { total_amount: 280 }
		})
	})

	it("counts amount history for a user with no game ledger entries", async () => {
		// User 11 never played a game but has +100 in amount history -> correct = 300.
		groupByMock.mockResolvedValue([])
		historyGroupByMock.mockResolvedValue([{ user_id: BigInt(11), _sum: { amount: 100 } }])
		userFindManyMock.mockResolvedValue([{ id: BigInt(11), total_amount: 300 }])

		const result = await reconcileAmount({ autofix: true })

		expect(result.mismatches).toHaveLength(0)
		expect(userUpdateMock).not.toHaveBeenCalled()
	})

	it("scopes both queries to specific ids when the selection lists them", async () => {
		groupByMock.mockResolvedValue([
			{ user_id: BigInt(11), _sum: { amount: -30 } },
			{ user_id: BigInt(12), _sum: { amount: 50 } }
		])
		userFindManyMock.mockResolvedValue([
			{ id: BigInt(11), total_amount: 200 },
			{ id: BigInt(12), total_amount: 200 }
		])
		userUpdateMock.mockResolvedValue({})

		const result = await reconcileAmount({
			autofix: true,
			selection: { ids: [BigInt(11), BigInt(12)] }
		})

		expect(groupByMock).toHaveBeenCalledWith(
			expect.objectContaining({ where: { amount: { not: null }, user_id: { in: [BigInt(11), BigInt(12)] } } })
		)
		expect(historyGroupByMock).toHaveBeenCalledWith(
			expect.objectContaining({ where: { user_id: { in: [BigInt(11), BigInt(12)] } } })
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

	it("scopes queries with gte for an open-ended selection (from)", async () => {
		groupByMock.mockResolvedValue([])
		userFindManyMock.mockResolvedValue([])

		await reconcileAmount({ selection: { ids: [], from: BigInt(5) } })

		expect(groupByMock).toHaveBeenCalledWith(
			expect.objectContaining({ where: { amount: { not: null }, user_id: { gte: BigInt(5) } } })
		)
		expect(historyGroupByMock).toHaveBeenCalledWith(
			expect.objectContaining({ where: { user_id: { gte: BigInt(5) } } })
		)
		expect(userFindManyMock).toHaveBeenCalledWith({
			where: { is_bot: false, id: { gte: BigInt(5) } },
			select: { id: true, total_amount: true }
		})
	})

	it("combines specific ids and an open-ended bound with OR", async () => {
		groupByMock.mockResolvedValue([])
		userFindManyMock.mockResolvedValue([])

		await reconcileAmount({ selection: { ids: [BigInt(1)], from: BigInt(5) } })

		expect(userFindManyMock).toHaveBeenCalledWith({
			where: { is_bot: false, OR: [{ id: { in: [BigInt(1)] } }, { id: { gte: BigInt(5) } }] },
			select: { id: true, total_amount: true }
		})
	})

	it("schedules the weekly reconciliation at 23:00 UTC on Sundays", () => {
		startAmountReconciler()

		expect(AMOUNT_RECONCILE_CRON).toBe("0 23 * * 0")
		expect(scheduleMock).toHaveBeenCalledWith(
			"0 23 * * 0",
			expect.any(Function),
			expect.objectContaining({ timezone: "Etc/UTC" })
		)
	})

	describe("parseUserIdSpec", () => {
		it("expands single ids and closed ranges", () => {
			expect(parseUserIdSpec("1, 4-6")).toEqual({
				ids: [BigInt(1), BigInt(4), BigInt(5), BigInt(6)],
				from: undefined
			})
		})

		it("reads an open-ended range as a from bound", () => {
			expect(parseUserIdSpec("5-")).toEqual({ ids: [], from: BigInt(5) })
		})

		it("combines specific ids with an open-ended bound", () => {
			expect(parseUserIdSpec("1, 5-")).toEqual({ ids: [BigInt(1)], from: BigInt(5) })
		})

		it("dedupes and sorts overlapping tokens", () => {
			expect(parseUserIdSpec("6, 4-6, 4")).toEqual({
				ids: [BigInt(4), BigInt(5), BigInt(6)],
				from: undefined
			})
		})

		it("keeps the smallest lower bound across multiple open ranges", () => {
			expect(parseUserIdSpec("10-, 3-")).toEqual({ ids: [], from: BigInt(3) })
		})

		it.each([
			["", "empty string"],
			["   ", "whitespace only"],
			["abc", "non-numeric token"],
			["1,", "trailing comma / empty token"],
			["0", "zero id"],
			["-5", "leading-dash range is unsupported"],
			["6-4", "descending range"],
			["1-200000", "range span exceeding the cap"]
		])("returns null for %s (%s)", spec => {
			expect(parseUserIdSpec(spec)).toBeNull()
		})
	})
})
