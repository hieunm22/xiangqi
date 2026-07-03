import { Response, Router } from "express"
import prisma from "prisma"
import { getAvatarUrl } from "common/helper"
import { requireAuth, AuthenticatedRequest } from "middleware/auth"

const router = Router()

/**
 * @swagger
 * /api/auth/user:
 *   get:
 *     summary: Get a user's information by ID (excluding password)
 *     tags:
 *       - Auth
 *     security:
 *       - basicAuth: []
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The user ID
 *     responses:
 *       200:
 *         description: User information with game statistics
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
 *                     user:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: integer
 *                         user_name:
 *                           type: string
 *                         email:
 *                           type: string
 *                         display_name:
 *                           type: string
 *                         gender:
 *                           type: boolean
 *                         avatar_url:
 *                           type: string
 *                         total_amount:
 *                           type: integer
 *                     stats:
 *                       type: object
 *                       properties:
 *                         win:
 *                           type: integer
 *                           description: Number of games won (amount > 0)
 *                         draw:
 *                           type: integer
 *                           description: Number of games drawn (amount = 0)
 *                         lose:
 *                           type: integer
 *                           description: Number of games lost (amount < 0)
 *       400:
 *         description: Invalid user ID
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
router.get("/auth/user", requireAuth(), async (req: AuthenticatedRequest, res: Response) => {
	const id = Number(req.query.id)

	if (!Number.isInteger(id) || id <= 0) {
		res.status(400).json({
			success: false,
			message: "Invalid user ID",
			status_code: 400
		})
		return
	}

	try {
		const user = await prisma.user.findUnique({
			where: { id },
			select: {
				id: true,
				user_name: true,
				email: true,
				display_name: true,
				gender: true,
				avatar_seq: true,
				total_amount: true
			}
		})

		if (!user) {
			res.status(404).json({
				success: false,
				message: "User not found",
				status_code: 404
			})
			return
		}

		// Get game statistics
		const gameUsers = await prisma.gameUser.findMany({
			where: { user_id: id }
		})

		const stats = {
			win: gameUsers.filter((gu) => gu.amount !== null && gu.amount > 0).length,
			draw: gameUsers.filter((gu) => gu.amount !== null && gu.amount === 0).length,
			lose: gameUsers.filter((gu) => gu.amount !== null && gu.amount < 0).length
		}

		const avatarUrl = getAvatarUrl(user.id, user.avatar_seq)
		const { avatar_seq: _avatarSeq, ...userWithoutAvatarSeq } = user

		res.status(200).json({
			success: true,
			message: "Success",
			status_code: 200,
			data: {
				user: {
					...userWithoutAvatarSeq,
					id: Number(user.id),
					avatar_url: avatarUrl
				},
				stats
			}
		})
	} catch (error) {
		console.error("Get user error:", error)
		res.status(500).json({
			success: false,
			message: "Internal server error",
			status_code: 500
		})
	}
})

export default router

