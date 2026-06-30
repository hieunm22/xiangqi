import cron from "node-cron"
import prisma from "prisma"
import { INITIAL_AMOUNT } from "common/constant"
import { PointMismatch, ReconcileOptions, ReconcileResult } from "types/job.type"

// 23:00 UTC every Sunday.
export const POINTS_RECONCILE_CRON = "0 23 * * 0"

/**
 * Recompute each real user's correct total_amount from the immutable GameUser
 * ledger (correct = INITIAL_AMOUNT + SUM(point), ignoring null points for PvE /
 * bot games) and compare against the cached total_amount. Every mismatch is
 * logged; corrections are written only when `autofix` is on. Uses two queries
 * total regardless of how many games exist, so it scales with users, not games.
 */
export async function reconcilePoints(options: Partial<ReconcileOptions> = {}): Promise<ReconcileResult> {
	const { autofix = false, userIds } = options

	const sums = await prisma.gameUser.groupBy({
		by: ["user_id"],
		where: {
			point: { not: null },
			...(userIds !== undefined && userIds.length > 0 ? { user_id: { in: userIds } } : {})
		},
		_sum: { point: true }
	})

	const sumByUser = new Map<bigint, number>()
	for (const row of sums) {
		sumByUser.set(row.user_id, row._sum.point ?? 0)
	}

	const users = await prisma.user.findMany({
		where: {
			is_bot: false,
			...(userIds !== undefined && userIds.length > 0 ? { id: { in: userIds } } : {})
		},
		select: { id: true, total_amount: true }
	})

	const mismatches: PointMismatch[] = []
	let fixed = 0

	for (const user of users) {
		const correct = INITIAL_AMOUNT + (sumByUser.get(user.id) ?? 0)
		if (correct === user.total_amount) {
			continue
		}

		const mismatch: PointMismatch = {
			userId: user.id.toString(),
			stored: user.total_amount,
			correct,
			diff: correct - user.total_amount
		}
		mismatches.push(mismatch)
		console.warn(
			`[reconcile-points] mismatch user=${mismatch.userId} stored=${mismatch.stored} correct=${mismatch.correct} diff=${mismatch.diff}`
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
		`[reconcile-points] checked=${users.length} mismatched=${mismatches.length} fixed=${fixed} autofix=${autofix}`
	)

	return { checked: users.length, mismatches, fixed }
}

/**
 * Schedule the weekly reconciliation (23:00 UTC every Sunday). Autofix is driven
 * by POINTS_RECONCILE_AUTOFIX (default off -> log only); POINTS_RECONCILE_CRON can
 * override the schedule. Safe to call once at boot.
 *
 * NOTE: this is an in-process scheduler. If the API is ever scaled to multiple
 * replicas it will run on each one; elect a single runner with a Redis lock or
 * node-cron's distributed coordinator before scaling out.
 */
export function startPointsReconciler() {
	const autofix = process.env.POINTS_RECONCILE_AUTOFIX === "true"
	const expression = process.env.POINTS_RECONCILE_CRON?.trim() || POINTS_RECONCILE_CRON

	cron.schedule(
		expression,
		async () => {
			try {
				await reconcilePoints({ autofix })
			} catch (err) {
				console.error("[reconcile-points] scheduled run failed:", err)
			}
		},
		{ timezone: "Etc/UTC", noOverlap: true }
	)

	console.log(`[reconcile-points] scheduled "${expression}" (UTC), autofix=${autofix}`)
}

// CLI entry: `node dist/job/reconcile-points.js [--fix] [--users=<id1>,<id2>,...]`
if (require.main === module) {
	const autofix = process.argv.includes("--fix")
	const usersArg = process.argv.find(arg => arg.startsWith("--users="))?.split("=")[1]
	const userIds = usersArg ? usersArg.split(",").map(id => BigInt(id.trim())) : undefined

	reconcilePoints({ autofix, userIds })
		.then(result => {
			console.log("[reconcile-points] done:", result)
			process.exit(0)
		})
		.catch(err => {
			console.error("[reconcile-points] failed:", err)
			process.exit(1)
		})
}
