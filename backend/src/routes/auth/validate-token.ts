import { Response, Router } from "express"
import { requireAuth, AuthenticatedRequest } from "middleware/auth"

const router = Router()

/**
 * @swagger
 * /api/auth/validate-token:
 *   post:
 *     summary: Validate the access token from the request header
 *     tags:
 *       - Auth
 *     security:
 *       - basicAuth: []
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Token is valid
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
 *                   example: validate-token.messages.success
 *                 status_code:
 *                   type: integer
 *                   example: 200
 *       401:
 *         description: Unauthorized (missing, invalid, or expired token)
 */
router.post("/auth/validate-token", requireAuth(), async (_: AuthenticatedRequest, res: Response) => {
	res.status(200).json({
		success: true,
		message: "validate-token.messages.success",
		status_code: 200
	})
})

export default router
