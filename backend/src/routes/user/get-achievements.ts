import { Response, Router } from "express"
import prisma from "prisma"
import { getCachedAchievements } from "common/game/achievement.helper"
import { requireAuth, AuthenticatedRequest } from "middleware/auth"

const router = Router()

/**
 * @swagger
 * /api/user/achievements:
 *   get:
 *     summary: Get all achievements with whether a given user has earned each
 *     tags:
 *       - User
 *     security:
 *       - basicAuth: []
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *         description: The user ID
 *     responses:
 *       200:
 *         description: List of achievements with earned status
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
 *                   example: achievement.messages.success
 *                 status_code:
 *                   type: integer
 *                   example: 200
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       name:
 *                         type: string
 *                         description: Localization key of the achievement title
 *                       earned:
 *                         type: boolean
 *       400:
 *         description: Invalid user ID
 *       401:
 *         description: Unauthorized (missing, invalid, or expired token)
 *       500:
 *         description: Internal server error
 */
router.get("/user/achievements", requireAuth(), async (req: AuthenticatedRequest, res: Response) => {
	const userId = Number(req.query.userId)

	if (!Number.isInteger(userId) || userId <= 0) {
		res.status(400).json({
			success: false,
			message: "achievement.messages.invalid-user-id",
			status_code: 400
		})
		return
	}

	try {
		const achievements = await getCachedAchievements()

		const earned = await prisma.userAchievement.findMany({
			where: { user_id: BigInt(userId) },
			select: { achievement_id: true }
		})

		const earnedIds = new Set(earned.map(row => row.achievement_id))

		const data = achievements.map(achievement => ({
			id: Number(achievement.id),
			name: achievement.name,
			earned: earnedIds.has(achievement.id)
		}))

		res.status(200).json({
			success: true,
			message: "achievement.messages.success",
			status_code: 200,
			data
		})
	} catch (error) {
		console.error("Get achievements error:", error)
		res.status(500).json({
			success: false,
			message: "achievement.messages.internal-server-error",
			status_code: 500
		})
	}
})

export default router
