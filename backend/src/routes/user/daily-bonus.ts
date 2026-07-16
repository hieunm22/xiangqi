import { Response, Router } from "express"
import prisma from "prisma"
import { AmountHistoryType } from "common/enums"
import { requireAuth, AuthenticatedRequest } from "middleware/auth"

const router = Router()

// Coin reward for each day of the login streak; the final day is the big reward.
const DAILY_REWARDS = [1000, 1200, 1400, 1600, 1800, 2000, 4000]
const TOTAL_DAYS = DAILY_REWARDS.length
const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Start of the current UTC day (00:00 GMT). One chest may be claimed per day.
 */
const getCurrentDay = (now: Date): Date => {
	const day = new Date(now)
	day.setUTCHours(0, 0, 0, 0)
	return day
}

/**
 * Resolve the login streak: returns `claimedToday` and `streak` (next day index).
 * A missed day or a completed 7-day cycle resets the streak to 0.
 */
const getStreakState = (count: number, claimedAt: Date | null, now: Date) => {
	if (claimedAt === null) return { streak: 0, claimedToday: false }

	const currentDay = getCurrentDay(now)
	if (claimedAt.getTime() >= currentDay.getTime()) {
		return { streak: count, claimedToday: true }
	}

	// A completed streak restarts the next day.
	if (count >= TOTAL_DAYS) return { streak: 0, claimedToday: false }

	// Claimed during the previous day → the streak continues.
	const previousDay = currentDay.getTime() - DAY_MS
	if (claimedAt.getTime() >= previousDay) return { streak: count, claimedToday: false }

	// Missed at least one full day → streak broken.
	return { streak: 0, claimedToday: false }
}

/**
 * @swagger
 * /api/user/daily-bonus:
 *   get:
 *     summary: Get the authenticated user's daily login-streak progress
 *     tags:
 *       - User
 *     security:
 *       - basicAuth: []
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Days claimed in the current streak and whether today's chest is available
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Success
 *                 status_code:
 *                   type: integer
 *                   example: 200
 *                 data:
 *                   type: object
 *                   properties:
 *                     claimed:
 *                       type: integer
 *                       description: Days already claimed this streak (also the next day index)
 *                     canClaim:
 *                       type: boolean
 *                       description: Whether today's chest can still be claimed
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
router.get("/user/daily-bonus", requireAuth(), async (req: AuthenticatedRequest, res: Response) => {
	try {
		const userId = req.auth?.userId

		if (!userId) {
			res.status(401).json({
				success: false,
				message: "Unauthorized",
				status_code: 401
			})
			return
		}

		const user = await prisma.user.findUnique({
			where: { id: BigInt(userId) },
			select: { daily_claimed_count: true, daily_claimed_at: true }
		})

		if (!user) {
			res.status(404).json({
				success: false,
				message: "User not found",
				status_code: 404
			})
			return
		}

		const { streak, claimedToday } = getStreakState(user.daily_claimed_count, user.daily_claimed_at, new Date())

		res.status(200).json({
			success: true,
			message: "Success",
			status_code: 200,
			data: {
				claimed: streak,
				canClaim: !claimedToday && streak < TOTAL_DAYS
			}
		})
	} catch (error) {
		console.error("Get daily bonus error:", error)
		res.status(500).json({
			success: false,
			message: "Internal server error",
			status_code: 500
		})
	}
})

/**
 * @swagger
 * /api/user/daily-bonus-claim:
 *   post:
 *     summary: Claim today's login chest and credit its coins
 *     tags:
 *       - User
 *     security:
 *       - basicAuth: []
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Streak progress after claiming today's chest
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Success
 *                 status_code:
 *                   type: integer
 *                   example: 200
 *                 data:
 *                   type: object
 *                   properties:
 *                     claimed:
 *                       type: integer
 *                     reward:
 *                       type: integer
 *                       description: Coins credited for today's chest
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 *       409:
 *         description: Today's chest was already claimed
 *       500:
 *         description: Internal server error
 */
router.post("/user/daily-bonus-claim", requireAuth(), async (req: AuthenticatedRequest, res: Response) => {
	try {
		const userId = req.auth?.userId

		if (!userId) {
			res.status(401).json({
				success: false,
				message: "Unauthorized",
				status_code: 401
			})
			return
		}

		// Claiming via the "watch video" flow doubles the reward
		const multiplier = req.body?.double === true ? 2 : 1

		const result = await prisma.$transaction(async (tx) => {
			const user = await tx.user.findUnique({
				where: { id: BigInt(userId) },
				select: { daily_claimed_count: true, daily_claimed_at: true }
			})

			if (!user) return { status: 404 as const }

			const { streak, claimedToday } = getStreakState(user.daily_claimed_count, user.daily_claimed_at, new Date())

			// Only one chest per day.
			if (claimedToday) return { status: 409 as const }

			// Credit today's reward and advance the streak atomically. Writing the
			// resolved streak+1 also persists a reset when the streak had broken.
			const reward = DAILY_REWARDS[streak] * multiplier

			await tx.userAmountHistory.create({
				data: {
					user_id: BigInt(userId),
					amount: reward,
					type: req.body?.double === true
						? AmountHistoryType.DailyBonusDouble
						: AmountHistoryType.DailyBonusNormal,
					created_at: new Date()
				}
			})

			await tx.user.update({
				where: { id: BigInt(userId) },
				data: {
					daily_claimed_count: streak + 1,
					daily_claimed_at: new Date(),
					total_amount: { increment: reward }
				}
			})

			return { status: 200 as const, claimed: streak + 1, reward }
		})

		if (result.status === 404) {
			res.status(404).json({
				success: false,
				message: "User not found",
				status_code: 404
			})
			return
		}

		if (result.status === 409) {
			res.status(409).json({
				success: false,
				message: "Already claimed today",
				status_code: 409
			})
			return
		}

		res.status(200).json({
			success: true,
			message: "Success",
			status_code: 200,
			data: {
				claimed: result.claimed,
				reward: result.reward
			}
		})
	} catch (error) {
		console.error("Claim daily bonus error:", error)
		res.status(500).json({
			success: false,
			message: "Internal server error",
			status_code: 500
		})
	}
})

export default router
