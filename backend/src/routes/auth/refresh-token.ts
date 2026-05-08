import { Response, Router } from "express"
import Redis from "ioredis"
import jwt from "jsonwebtoken"
import { requireAuth, AuthenticatedRequest } from "../../middleware/auth"
import { REFRESH_TOKEN_KEY } from "../../common/constant"

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
 * /api/auth/refresh-token:
 *   post:
 *     summary: Refresh access token
 *     tags:
 *       - Auth
 *     security:
 *       - basicAuth: []
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: New access token issued
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 status_code:
 *                   type: integer
 *                 access_token:
 *                   type: string
 *                 token_type:
 *                   type: string
 *       401:
 *         description: Unauthorized
 */
router.post("/auth/refresh-token", requireAuth(true), async (req: AuthenticatedRequest, res: Response) => {
	const refreshTokenCookie = req.cookies?.[REFRESH_TOKEN_KEY]
	const userId = req.auth?.userId
	const sessionId = req.auth?.sessionId

	if (!refreshTokenCookie) {
		res.status(401).json({
			success: false,
			message: "Missing refresh token cookie",
			status_code: 401,
			access_token: "",
			token_type: "Bearer"
		})
		return
	}

	const cachedRefreshToken = await redis.get(`${REFRESH_TOKEN_KEY}:${userId}:${sessionId}`)

	if (!cachedRefreshToken || cachedRefreshToken !== refreshTokenCookie) {
		res.status(401).json({
			success: false,
			message: "Refresh token mismatch or expired",
			status_code: 401,
			access_token: "",
			token_type: "Bearer"
		})
		return
	}

	// Issue new access token — keep all original payload fields, update only exp
	const payload = req.auth?.payload
	const { iat, exp, iss, ...restPayload } = payload || {}
	const access_token = jwt.sign(restPayload, JWT_SECRET, {
		expiresIn: "1h",
		issuer: JWT_ISSUER
	})

	res.status(200).json({
		success: true,
		message: "Token refreshed",
		status_code: 200,
		access_token,
		token_type: "Bearer"
	})
})

export default router
