import { Response, Router } from "express"
import prisma from "prisma"
import { getAvatarUrl } from "common/helper"
import { requireAuth, AuthenticatedRequest } from "middleware/auth"

const router = Router()

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 50

/**
 * @swagger
 * /api/user/leaderboard:
 *   get:
 *     summary: List top users ranked by total amount (paginated for infinite scroll)
 *     tags:
 *       - User
 *     security:
 *       - basicAuth: []
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: offset
 *         required: false
 *         schema:
 *           type: integer
 *         description: Number of users to skip (default 0). Used for infinite scroll paging.
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *         description: Page size (default 20, clamped to a maximum of 50).
 *     responses:
 *       200:
 *         description: One page of users ordered by total_amount desc, then display_name asc
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
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       display_name:
 *                         type: string
 *                       avatar_url:
 *                         type: string
 *                       total_amount:
 *                         type: integer
 *       500:
 *         description: Internal server error
 */
router.get("/user/leaderboard", requireAuth(), async (req: AuthenticatedRequest, res: Response) => {
	const offsetRaw = Number(req.query.offset)
	const limitRaw = Number(req.query.limit)

	const offset = Number.isInteger(offsetRaw) && offsetRaw > 0 ? offsetRaw : 0
	const limit = Number.isInteger(limitRaw) && limitRaw > 0
		? Math.min(limitRaw, MAX_LIMIT)
		: DEFAULT_LIMIT

	try {
		const users = await prisma.user.findMany({
			where: { is_bot: false },
			orderBy: [
				{ total_amount: "desc" },
				{ display_name: "asc" }
			],
			skip: offset,
			take: limit,
			select: {
				id: true,
				display_name: true,
				avatar_seq: true,
				total_amount: true
			}
		})

		const result = users.map(user => ({
			id: Number(user.id),
			display_name: user.display_name,
			avatar_url: getAvatarUrl(Number(user.id), user.avatar_seq),
			total_amount: user.total_amount
		}))

		res.status(200).json({
			success: true,
			message: "Success",
			status_code: 200,
			data: result
		})
	} catch (error) {
		console.error("Leaderboard error:", error)
		res.status(500).json({
			success: false,
			message: "Internal server error",
			status_code: 500
		})
	}
})

export default router
