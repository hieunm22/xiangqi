import { Response, Router } from "express"
import jwt from "jsonwebtoken"
import { REFRESH_TOKEN_KEY } from "common/constant"
// import redis from "common/redis"
import { requireAuth, AuthenticatedRequest } from "middleware/auth"
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
router.post("/auth/refresh-token", requireAuth(true), async (req: AuthenticatedRequest, res: Response) => {
	const refreshTokenCookie = req.cookies?.[REFRESH_TOKEN_KEY]
	const userId = req.auth?.userId
	const sessionId = req.auth?.sessionId

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

	// const cachedRefreshToken = await redis.get(`${REFRESH_TOKEN_KEY}:${userId}:${sessionId}`)

	// if (!cachedRefreshToken || cachedRefreshToken !== refreshTokenCookie) {
	// 	res.status(401).json({
	// 		success: false,
	// 		message: "refresh-token.messages.mismatch-or-expired",
	// 		status_code: 401,
	// 		access_token: "",
	// 		token_type: "Bearer"
	// 	} as LoginSuccessResponse)
	// 	return
	// }

	// Issue new access token — keep all original payload fields, update only exp
	const payload = req.auth?.payload
	const { iat, exp, iss, ...restPayload } = payload || {}
	const access_token = jwt.sign(restPayload, JWT_SECRET, {
		expiresIn: "1h",
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
