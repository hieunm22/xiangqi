import { Request, Response, Router } from "express"
import Redis from "ioredis"
import jwt from "jsonwebtoken"
import { LOGIN_SESSION_KEY, REFRESH_TOKEN_KEY } from "../../common/constant"

const router = Router()

const redis = new Redis({
	host: process.env.REDIS_HOST?.trim() || "localhost",
	port: Number(process.env.REDIS_PORT) || 6379,
	db: 4
})

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
router.delete("/auth/logout", async (req: Request, res: Response) => {
	const authHeader = req.headers.authorization

	if (!authHeader?.startsWith("Bearer ")) {
		res.status(401).json({
			success: false,
			message: "Missing or invalid Authorization header",
			status_code: 401
		})
		return
	}

	const token = authHeader.slice(7)
	const payload = jwt.decode(token) as jwt.JwtPayload | null
	const userId = payload?.sub
	const sessionId = payload?.jti

	if (!userId || !sessionId) {
		res.status(401).json({
			success: false,
			message: "Invalid token payload",
			status_code: 401
		})
		return
	}

	try {
		const loginSessionKey = `${LOGIN_SESSION_KEY}:${userId}:${sessionId}`
		const refreshTokenKey = `${REFRESH_TOKEN_KEY}:${userId}:${sessionId}`
		const sessionExists = await redis.exists(loginSessionKey)

		if (sessionExists) {
			await redis.del(loginSessionKey)
			await redis.del(refreshTokenKey)
		}

		res.clearCookie(REFRESH_TOKEN_KEY, {
			httpOnly: true,
			secure: process.env.NODE_ENV === "production",
			sameSite: process.env.NODE_ENV === "production" ? "none" : "lax"
		})

		res.status(200).json({
			success: true,
			message: sessionExists ? "Logout successful" : "Session already inactive",
			status_code: 200
		})
	} catch (error) {
		console.error("Logout error:", error)
		res.status(500).json({
			success: false,
			message: "Internal server error",
			status_code: 500
		})
	}
})

export default router
