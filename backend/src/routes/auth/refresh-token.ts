import { Request, Response, Router } from "express"
import jwt from "jsonwebtoken"
import {
	ACCESS_TOKEN_EXPIRES_IN,
	REFRESH_TOKEN_KEY
} from "common/constant"
import redis from "common/redis"
import { LoginSuccessResponse } from "types/auth.type"

const router = Router()

const JWT_SECRET = process.env.JWT_SECRET!
const JWT_ISSUER = process.env.JWT_ISSUER?.trim() || "localhost:8000"

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
router.post("/auth/refresh-token", async (req: Request, res: Response) => {
	const refreshTokenCookie = req.cookies?.[REFRESH_TOKEN_KEY]

	if (!refreshTokenCookie) {
		res.status(401).json({
			success: false,
			message: "refresh-token.messages.missing-refresh-token",
			status_code: 401,
			access_token: "",
			token_type: "Bearer"
		} as LoginSuccessResponse)
		return
	}

	const authHeader = req.headers.authorization
	const accessToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined
	const decoded = accessToken ? jwt.decode(accessToken) as jwt.JwtPayload | null : null

	const userId = Number(decoded?.sub)
	const sessionId = String(decoded?.jti || "")

	if (!userId || !sessionId) {
		res.status(401).json({
			success: false,
			message: "refresh-token.messages.mismatch-or-expired",
			status_code: 401,
			access_token: "",
			token_type: "Bearer"
		} as LoginSuccessResponse)
		return
	}

	const cachedRefreshToken = await redis.get(`${REFRESH_TOKEN_KEY}:${userId}:${sessionId}`)
	if (!cachedRefreshToken || cachedRefreshToken !== refreshTokenCookie) {
		res.status(401).json({
			success: false,
			message: "refresh-token.messages.mismatch-or-expired",
			status_code: 401,
			access_token: "",
			token_type: "Bearer"
		} as LoginSuccessResponse)
		return
	}

	const { iat, exp, iss, ...restPayload } = decoded!
	const access_token = jwt.sign(restPayload, JWT_SECRET, {
		expiresIn: ACCESS_TOKEN_EXPIRES_IN,
		issuer: JWT_ISSUER
	})

	res.status(200).json({
		success: true,
		message: "refresh-token.messages.success",
		status_code: 200,
		access_token,
		token_type: "Bearer"
	} as LoginSuccessResponse)
})

export default router
