import { Request, Response, Router } from "express"
import Redis from "ioredis"
import jwt from "jsonwebtoken"

const router = Router()

const JWT_SECRET = process.env.JWT_SECRET!
const JWT_ISSUER = process.env.JWT_ISSUER?.trim() || "localhost:8000"

const redis = new Redis({
	host: process.env.REDIS_HOST?.trim() || "localhost",
	port: Number(process.env.REDIS_PORT) || 6379,
	db: 4
})

/**
 * @swagger
 * /api/auth/validate-token:
 *   post:
 *     summary: Validate the access token from the request header
 *     tags:
 *       - Auth
 *     parameters:
 *       - in: header
 *         name: xiangqi-token
 *         required: true
 *         schema:
 *           type: string
 *         description: JWT access token
 *     responses:
 *       200:
 *         description: Token is valid
 *       401:
 *         description: Token missing, invalid, or expired — session has been cleared
 *       500:
 *         description: Internal server error
 */
router.post("/auth/validate-token", async (req: Request, res: Response) => {
	const token = req.headers["xiangqi-token"] as string | undefined

	if (!token?.trim()) {
		res.status(401).json({ success: false, message: "Token not provided", status_code: 401 })
		return
	}

	// Decode without verification first so we can clean up the session on failure
	const decoded = jwt.decode(token) as { sub?: number; jti?: string } | null

	try {
		jwt.verify(token, JWT_SECRET, { issuer: JWT_ISSUER })

		res.status(200).json({ success: true, message: "Token is valid", status_code: 200 })
	} catch {
		// Token invalid or expired — remove login session and refresh token if we can identify them
		if (decoded?.sub && decoded?.jti) {
			const userId = decoded.sub
			const sessionId = decoded.jti
			await redis.del(`login-session:${userId}:${sessionId}`)
			await redis.del(`refresh-token:${userId}:${sessionId}`)
		}

		res.status(401).json({ success: false, message: "Token is invalid or expired", status_code: 401 })
	}
})

export default router
