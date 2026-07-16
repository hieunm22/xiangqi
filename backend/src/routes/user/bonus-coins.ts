import { Response, Router } from "express"
import prisma from "prisma"
import { AmountHistoryType } from "common/enums"
import { requireAuth, AuthenticatedRequest } from "middleware/auth"

const router = Router()

// Coin reward for each treasure, claimed in order. The length is the number of
// treasures available per slot.
const BONUS_REWARDS = [800, 900, 1000, 1100, 1200, 1300, 2000]
const TOTAL_TREASURES = BONUS_REWARDS.length
const SLOT_HOURS = 8

/**
 * Return the most recent 8-hour boundary (00:00, 08:00, 16:00 UTC) at or
 * before `now`. The 7 treasures reload once per slot.
 */
const getCurrentSlot = (now: Date): Date => {
	const slot = new Date(now)
	slot.setUTCMinutes(0, 0, 0)
	slot.setUTCHours(Math.floor(now.getUTCHours() / SLOT_HOURS) * SLOT_HOURS)
	return slot
}

/**
 * How many treasures have been claimed in the current slot. When the stored
 * claim belongs to an earlier slot the count is reset to 0 (treasures reload).
 */
const getClaimedInSlot = (claimedCount: number, claimedAt: Date | null, currentSlot: Date): number => {
	if (claimedAt === null || claimedAt.getTime() < currentSlot.getTime()) return 0
	return claimedCount
}

/**
 * @swagger
 * /api/user/bonus-coins:
 *   get:
 *     summary: Get the authenticated user's bonus-coin progress for the current slot
 *     tags:
 *       - User
 *     security:
 *       - basicAuth: []
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Treasures claimed this slot, the total, and whether any remain
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
 *                       description: Treasures already claimed this slot (also the next index)
 *                     pending:
 *                       type: boolean
 *                       description: Whether at least one treasure is still claimable
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
router.get("/user/bonus-coins", requireAuth(), async (req: AuthenticatedRequest, res: Response) => {
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
			select: { bonus_claimed_count: true, bonus_claimed_at: true }
		})

		if (!user) {
			res.status(404).json({
				success: false,
				message: "User not found",
				status_code: 404
			})
			return
		}

		const currentSlot = getCurrentSlot(new Date())
		const claimed = getClaimedInSlot(user.bonus_claimed_count, user.bonus_claimed_at, currentSlot)

		res.status(200).json({
			success: true,
			message: "Success",
			status_code: 200,
			data: {
				claimed,
				pending: claimed < TOTAL_TREASURES
			}
		})
	} catch (error) {
		console.error("Get bonus coins error:", error)
		res.status(500).json({
			success: false,
			message: "Internal server error",
			status_code: 500
		})
	}
})

/**
 * @swagger
 * /api/user/bonus-coins-claim:
 *   post:
 *     summary: Claim the next treasure for the current slot and credit its coins
 *     tags:
 *       - User
 *     security:
 *       - basicAuth: []
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Progress after claiming the next treasure
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
 *                       description: Coins credited for this treasure
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 *       409:
 *         description: All treasures already claimed this slot
 *       500:
 *         description: Internal server error
 */
router.post("/user/bonus-coins-claim", requireAuth(), async (req: AuthenticatedRequest, res: Response) => {
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

		const currentSlot = getCurrentSlot(new Date())

		const result = await prisma.$transaction(async (tx) => {
			const user = await tx.user.findUnique({
				where: { id: BigInt(userId) },
				select: { bonus_claimed_count: true, bonus_claimed_at: true }
			})

			if (!user) return { status: 404 as const }

			const claimed = getClaimedInSlot(user.bonus_claimed_count, user.bonus_claimed_at, currentSlot)

			// Every treasure for this slot has been collected already.
			if (claimed >= TOTAL_TREASURES) return { status: 409 as const }

			// Credit the reward for the next treasure and advance progress atomically
			const reward = BONUS_REWARDS[claimed]

			await tx.userAmountHistory.create({
				data: {
					user_id: BigInt(userId),
					amount: reward,
					type: AmountHistoryType.BonusCoin,
					created_at: new Date()
				}
			})

			await tx.user.update({
				where: { id: BigInt(userId) },
				data: {
					bonus_claimed_count: claimed + 1,
					bonus_claimed_at: new Date(),
					total_amount: { increment: reward }
				}
			})

			return { status: 200 as const, claimed: claimed + 1, reward }
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
				message: "All treasures already claimed",
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
		console.error("Claim bonus coin error:", error)
		res.status(500).json({
			success: false,
			message: "Internal server error",
			status_code: 500
		})
	}
})

export default router
