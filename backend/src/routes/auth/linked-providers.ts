import { Response, Router } from "express"
import prisma from "prisma"
import { requireAuth, AuthenticatedRequest } from "middleware/auth"

const router = Router()

/**
 * @swagger
 * /api/auth/linked-providers:
 *   get:
 *     summary: List the social providers linked to the authenticated user
 *     tags:
 *       - Auth
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Linked providers
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 status_code:
 *                   type: integer
 *                 data:
 *                   type: object
 *                   properties:
 *                     providers:
 *                       type: array
 *                       items:
 *                         type: string
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get("/auth/linked-providers", requireAuth(), async (req: AuthenticatedRequest, res: Response) => {
	const userId = Number(req.auth?.userId)

	try {
		const rows = await prisma.userIdentity.findMany({
			where: { user_id: userId },
			select: { provider: true }
		})

		res.status(200).json({
			success: true,
			status_code: 200,
			data: { providers: rows.map(row => row.provider) }
		})
	} catch (err) {
		console.error("List linked providers error:", err)
		res.status(500).json({
			success: false,
			message: "facebook-link.messages.internal-server-error",
			status_code: 500
		})
	}
})

export default router
