import { Response, Router } from "express"
import prisma from "prisma"
import { AmountHistoryType } from "common/enums"
import { requireAuth, AuthenticatedRequest } from "middleware/auth"

const router = Router()

const SPINS_PER_SLOT = 3
const SLOT_HOURS = 6

/**
 * Return the most recent 6-hour boundary (00:00, 06:00, 12:00, 18:00 UTC) at or
 * before `now`. Users receive +3 spins once per slot when they visit the wheel.
 */
const getCurrentSlot = (now: Date): Date => {
	const slot = new Date(now)
	slot.setUTCMinutes(0, 0, 0)
	slot.setUTCHours(Math.floor(now.getUTCHours() / SLOT_HOURS) * SLOT_HOURS)
	return slot
}

/**
 * True when the user has not yet claimed the current slot's bonus spins.
 */
const hasPendingSpins = (claimedAt: Date | null, currentSlot: Date): boolean =>
	claimedAt === null || claimedAt.getTime() < currentSlot.getTime()

/**
 * @swagger
 * /api/user/lucky-spins:
 *   get:
 *     summary: Get the authenticated user's remaining lucky-wheel spins
 *     tags:
 *       - User
 *     security:
 *       - basicAuth: []
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current spins and whether a slot bonus is pending
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
 *                     spins:
 *                       type: integer
 *                       description: Remaining spins
 *                     pending:
 *                       type: boolean
 *                       description: Whether a slot bonus is available to claim
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
router.get("/user/lucky-spins", requireAuth(), async (req: AuthenticatedRequest, res: Response) => {
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
			select: { lucky_spins: true, lucky_claimed_at: true }
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

		res.status(200).json({
			success: true,
			message: "Success",
			status_code: 200,
			data: {
				spins: user.lucky_spins,
				pending: hasPendingSpins(user.lucky_claimed_at, currentSlot)
			}
		})
	} catch (error) {
		console.error("Get lucky spins error:", error)
		res.status(500).json({
			success: false,
			message: "Internal server error",
			status_code: 500
		})
	}
})

/**
 * @swagger
 * /api/user/lucky-spins-claim:
 *   post:
 *     summary: Claim the current slot's bonus spins (+3) if not yet claimed
 *     tags:
 *       - User
 *     security:
 *       - basicAuth: []
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Updated spins after claiming (idempotent within a slot)
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
 *                     spins:
 *                       type: integer
 *                     pending:
 *                       type: boolean
 *                       example: false
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
router.post("/user/lucky-spins-claim", requireAuth(), async (req: AuthenticatedRequest, res: Response) => {
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

		const spins = await prisma.$transaction(async (tx) => {
			const user = await tx.user.findUnique({
				where: { id: BigInt(userId) },
				select: { lucky_spins: true, lucky_claimed_at: true }
			})

			if (!user) return null

			// Already claimed this slot: return current spins unchanged.
			if (!hasPendingSpins(user.lucky_claimed_at, currentSlot)) {
				return user.lucky_spins
			}

			// Record the actual claim time. Any timestamp within the current slot
			// keeps hasPendingSpins() false until the next 6h boundary passes.
			const updated = await tx.user.update({
				where: { id: BigInt(userId) },
				data: {
					lucky_spins: { increment: SPINS_PER_SLOT },
					lucky_claimed_at: new Date()
				},
				select: { lucky_spins: true }
			})

			return updated.lucky_spins
		})

		if (spins === null) {
			res.status(404).json({
				success: false,
				message: "User not found",
				status_code: 404
			})
			return
		}

		res.status(200).json({
			success: true,
			message: "Success",
			status_code: 200,
			data: {
				spins,
				pending: false
			}
		})
	} catch (error) {
		console.error("Claim lucky spins error:", error)
		res.status(500).json({
			success: false,
			message: "Internal server error",
			status_code: 500
		})
	}
})

/**
 * @swagger
 * /api/user/lucky-spin:
 *   post:
 *     summary: Consume one spin and credit its reward in a single transaction
 *     tags:
 *       - User
 *     security:
 *       - basicAuth: []
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *             properties:
 *               amount:
 *                 type: integer
 *                 description: The reward amount to credit to the user's balance
 *                 example: 100
 *     responses:
 *       200:
 *         description: Remaining spins after consuming one
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
 *                     spins:
 *                       type: integer
 *       400:
 *         description: Invalid or missing amount parameter
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 *       409:
 *         description: No spins remaining
 *       500:
 *         description: Internal server error
 */
router.post("/user/lucky-spin", requireAuth(), async (req: AuthenticatedRequest, res: Response) => {
	try {
		const { amount } = req.body
		const userId = req.auth?.userId

		if (!userId) {
			res.status(401).json({
				success: false,
				message: "Unauthorized",
				status_code: 401
			})
			return
		}

		if (amount === undefined || amount === null) {
			res.status(400).json({
				success: false,
				message: "Amount parameter is required",
				status_code: 400
			})
			return
		}

		const amountNumber = Number(amount)
		if (!Number.isInteger(amountNumber)) {
			res.status(400).json({
				success: false,
				message: "Amount must be an integer",
				status_code: 400
			})
			return
		}

		const result = await prisma.$transaction(async (tx) => {
			const user = await tx.user.findUnique({
				where: { id: BigInt(userId) },
				select: { lucky_spins: true }
			})

			if (!user) return { status: 404 as const }
			if (user.lucky_spins <= 0) return { status: 409 as const }

			// Consume one spin and credit its reward atomically: the reward is only
			// granted when a spin was actually available to consume.
			await tx.userAmountHistory.create({
				data: {
					user_id: BigInt(userId),
					amount: amountNumber,
					type: AmountHistoryType.LuckyWheel,
					created_at: new Date()
				}
			})

			const updated = await tx.user.update({
				where: { id: BigInt(userId) },
				data: {
					lucky_spins: { decrement: 1 },
					total_amount: { increment: amountNumber }
				},
				select: { lucky_spins: true }
			})

			return { status: 200 as const, spins: updated.lucky_spins }
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
				message: "No spins remaining",
				status_code: 409
			})
			return
		}

		res.status(200).json({
			success: true,
			message: "Success",
			status_code: 200,
			data: {
				spins: result.spins
			}
		})
	} catch (error) {
		console.error("Consume lucky spin error:", error)
		res.status(500).json({
			success: false,
			message: "Internal server error",
			status_code: 500
		})
	}
})

export default router
