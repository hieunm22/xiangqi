import cron from "node-cron"
import prisma from "prisma"
import { INITIAL_AMOUNT } from "common/constant"
import {
	AmountMismatch,
	ReconcileOptions,
	ReconcileResult,
	UserIdSelection
} from "types/job.type"

// 23:00 UTC every Sunday.
export const AMOUNT_RECONCILE_CRON = "0 23 * * 0"

// Upper bound on how many ids a single closed range "A-B" may expand to, to keep a
// malformed/huge spec from exploding into memory.
const MAX_RANGE_SPAN = 100000

/**
 * Parse a printer-page-range style user-id spec into a selection:
 *   "1, 4-6" -> { ids: [1, 4, 5, 6] }
 *   "5-"     -> { from: 5 } // every user with id >= 5
 *   "1, 5-"  -> { ids: [1], from: 5 }
 * Returns null on any malformed token (caller should reject the request).
 */
export function parseUserIdSpec(spec: string): UserIdSelection | null {
	if (typeof spec !== "string") {
		return null
	}
	const trimmed = spec.trim()
	if (trimmed === "") {
		return null
	}

	const ids = new Set<bigint>()
	let from: bigint | undefined

	for (const rawToken of trimmed.split(",")) {
		const token = rawToken.trim()
		if (token === "") {
			return null
		}

		// Open-ended range "N-": from N to the end.
		let match = token.match(/^(\d+)-$/)
		if (match) {
			const start = BigInt(match[1])
			if (start <= 0n) {
				return null
			}
			from = from === undefined || start < from ? start : from
			continue
		}

		// Closed range "A-B".
		match = token.match(/^(\d+)-(\d+)$/)
		if (match) {
			const start = BigInt(match[1])
			const end = BigInt(match[2])
			if (start <= 0n || end <= 0n || start > end || end - start >= BigInt(MAX_RANGE_SPAN)) {
				return null
			}
			for (let i = start; i <= end; i++) {
				ids.add(i)
			}
			continue
		}

		// Single id "N".
		match = token.match(/^(\d+)$/)
		if (match) {
			const value = BigInt(match[1])
			if (value <= 0n) {
				return null
			}
			ids.add(value)
			continue
		}

		return null
	}

	return {
		ids: [...ids].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)),
		from
	}
}

// Build a Prisma where-fragment restricting a user id field to the selection.
// Combines specific ids ("in") and an open-ended lower bound ("gte") with OR.
function buildUserWhere(
	selection: UserIdSelection | undefined,
	field: "user_id" | "id"
): Record<string, unknown> {
	if (!selection) {
		return {}
	}
	const clauses: Record<string, unknown>[] = []
	if (selection.ids.length > 0) {
		clauses.push({ [field]: { in: selection.ids } })
	}
	if (selection.from !== undefined) {
		clauses.push({ [field]: { gte: selection.from } })
	}
	if (clauses.length === 0) {
		return {}
	}
	if (clauses.length === 1) {
		return clauses[0]
	}
	return { OR: clauses }
}

/**
 * Recompute each real user's correct total_amount from the two immutable ledgers
 * and compare against the cached total_amount:
 *   correct = INITIAL_AMOUNT
 *     + SUM(GameUser.amount)             // per-game win/loss
 *     + SUM(UserAmountHistory.amount)   // non-game adjustments
 * Every mismatch is logged; corrections are written only when `autofix` is on.
 * Uses three queries total regardless of how many games or history rows exist,
 * so it scales with users, not transactions.
 */
export async function reconcileAmount(options: Partial<ReconcileOptions> = {}): Promise<ReconcileResult> {
	const { autofix = false, selection } = options

	const userScope = buildUserWhere(selection, "user_id")

	const gameSums = await prisma.gameUser.groupBy({
		by: ["user_id"],
		where: {
			amount: { not: null },
			...userScope
		},
		_sum: { amount: true }
	})

	const historySums = await prisma.userAmountHistory.groupBy({
		by: ["user_id"],
		where: { ...userScope },
		_sum: { amount: true }
	})

	const sumByUser = new Map<bigint, number>()
	for (const row of gameSums) {
		sumByUser.set(row.user_id, row._sum.amount ?? 0)
	}
	for (const row of historySums) {
		sumByUser.set(row.user_id, (sumByUser.get(row.user_id) ?? 0) + (row._sum.amount ?? 0))
	}

	const users = await prisma.user.findMany({
		where: {
			is_bot: false,
			...buildUserWhere(selection, "id")
		},
		select: { id: true, total_amount: true }
	})

	const mismatches: AmountMismatch[] = []
	let fixed = 0

	for (const user of users) {
		const correct = INITIAL_AMOUNT + (sumByUser.get(user.id) ?? 0)
		if (correct === user.total_amount) {
			continue
		}

		const mismatch: AmountMismatch = {
			userId: user.id.toString(),
			stored: user.total_amount,
			correct,
			diff: correct - user.total_amount
		}
		mismatches.push(mismatch)
		console.warn(
			`[reconcile-amount] mismatch user=${mismatch.userId} stored=${mismatch.stored} correct=${mismatch.correct} diff=${mismatch.diff}`
		)

		if (autofix) {
			await prisma.user.update({
				where: { id: user.id },
				data: { total_amount: correct }
			})
			fixed += 1
		}
	}

	console.log(
		`[reconcile-amount] checked=${users.length} mismatched=${mismatches.length} fixed=${fixed} autofix=${autofix}`
	)

	return { checked: users.length, mismatches, fixed }
}

/**
 * Schedule the weekly reconciliation (23:00 UTC every Sunday). Autofix is driven
 * by AMOUNT_RECONCILE_AUTOFIX (default off -> log only); AMOUNT_RECONCILE_CRON can
 * override the schedule. Safe to call once at boot.
 *
 * NOTE: this is an in-process scheduler. If the API is ever scaled to multiple
 * replicas it will run on each one; elect a single runner with a Redis lock or
 * node-cron's distributed coordinator before scaling out.
 */
export function startAmountReconciler() {
	const autofix = process.env.AMOUNT_RECONCILE_AUTOFIX === "true"
	const expression = process.env.AMOUNT_RECONCILE_CRON?.trim() || AMOUNT_RECONCILE_CRON

	cron.schedule(
		expression,
		async () => {
			try {
				await reconcileAmount({ autofix })
			} catch (err) {
				console.error("[reconcile-amount] scheduled run failed:", err)
			}
		},
		{ timezone: "Etc/UTC", noOverlap: true }
	)

	console.log(`[reconcile-amount] scheduled "${expression}" (UTC), autofix=${autofix}`)
}

// CLI entry: `node dist/job/reconcile-amount.js [--fix] [--users="1, 4-6, 10-"]`
if (require.main === module) {
	const autofix = process.argv.includes("--fix")
	const usersArg = process.argv.find(arg => arg.startsWith("--users="))?.split("=")[1]
	const selection = usersArg ? parseUserIdSpec(usersArg) : undefined

	if (usersArg && selection === null) {
		console.error(`[reconcile-amount] invalid --users spec: "${usersArg}"`)
		process.exit(1)
	}

	reconcileAmount({ autofix, selection: selection ?? undefined })
		.then(result => {
			console.log("[reconcile-amount] done:", result)
			process.exit(0)
		})
		.catch(err => {
			console.error("[reconcile-amount] failed:", err)
			process.exit(1)
		})
}
