import { Response, Router } from "express"
import { requireAuth, AuthenticatedRequest } from "../../middleware/auth"

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
 *       401:
 *         description: Token missing, invalid, or expired — session has been cleared
 *       500:
 *         description: Internal server error
 */
router.post("/auth/validate-token", requireAuth(), async (_: AuthenticatedRequest, res: Response) => {
	res.status(200).json({ success: true, message: "Token is valid", status_code: 200 })
})

export default router
