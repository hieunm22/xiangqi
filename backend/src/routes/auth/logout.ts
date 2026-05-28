import { Response, Router } from "express"
import prisma from "prisma"
import {
	LOGIN_SESSION_KEY,
	REFRESH_TOKEN_KEY,
	REFRESH_TOKEN_TTL_SECONDS
} from "common/constant"
import { getRefreshCookieOptions } from "common/cookie"
import redis from "common/redis"
import { requireAuth, AuthenticatedRequest } from "middleware/auth"

const router = Router()

/**
 * @swagger
 * /api/auth/logout:
 *   delete:
 *     summary: Logout current session
 *     tags:
 *       - Auth
 *     security:
 *       - basicAuth: []
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logout handled
 *       401:
 *         description: Missing or invalid Authorization header
 *       500:
 *         description: Internal server error
 */
router.delete("/auth/logout", requireAuth(true), async (req: AuthenticatedRequest, res: Response) => {
	const userId = req.auth?.userId
	const sessionId = req.auth?.sessionId

	try {
		// delete user from all rooms they are participating in
		if (userId) {
			await prisma.roomUser.deleteMany({
				where: {
					user_id: Number(userId)
				}
			})
		}

		const loginSessionKey = `${LOGIN_SESSION_KEY}:${userId}:${sessionId}`
		const refreshTokenKey = `${REFRESH_TOKEN_KEY}:${userId}:${sessionId}`
		const sessionExists = await redis.exists(loginSessionKey)

		if (sessionExists) {
			await redis.del(loginSessionKey)
			await redis.del(refreshTokenKey)
		}

		const options = getRefreshCookieOptions(REFRESH_TOKEN_TTL_SECONDS * 1000)
		res.clearCookie(REFRESH_TOKEN_KEY, options)

		res.status(200).json({
			success: true,
			message: sessionExists ? "logout.messages.success" : "logout.messages.already-inactive",
			status_code: 200
		})
	} catch (error) {
		console.error("Logout error:", error)
		res.status(500).json({
			success: false,
			message: "logout.messages.internal-server-error",
			status_code: 500
		})
	}
})

export default router
