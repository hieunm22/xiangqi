import { Response, Router } from "express"
import {
	LOGIN_SESSION_KEY,
	REFRESH_TOKEN_KEY,
	REFRESH_TOKEN_TTL_SECONDS
} from "common/constant"
import { getRefreshCookieOptions } from "common/cookie"
import { markOffline } from "common/presence"
import redis from "common/redis"
import { emitPresenceChanged, getConnectedDeviceCount } from "common/socket"
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
 *                   example: logout.messages.success
 *                 status_code:
 *                   type: integer
 *                   example: 200
 *       401:
 *         description: Unauthorized (missing, invalid, or expired token)
 *       500:
 *         description: Internal server error
 */
router.delete("/auth/logout", requireAuth(true), async (req: AuthenticatedRequest, res: Response) => {
	const userId = req.auth?.userId
	const sessionId = req.auth?.sessionId

	try {
		const loginSessionKey = `${LOGIN_SESSION_KEY}:${userId}:${sessionId}`
		const refreshTokenKey = `${REFRESH_TOKEN_KEY}:${userId}:${sessionId}`
		const sessionExists = await redis.exists(loginSessionKey)

		if (sessionExists) {
			await redis.del(loginSessionKey)
			await redis.del(refreshTokenKey)
		}

		// Drop presence immediately when this is their last connected device.
		// With another device still online, leaving presence
		// alone lets that device's heartbeat keep the user online
		if (userId && getConnectedDeviceCount(Number(userId)) <= 1) {
			const wasOnline = await markOffline(Number(userId))
			if (wasOnline) {
				emitPresenceChanged(Number(userId), "offline")
			}
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
