import { Response, Router } from "express"
import jwt from "jsonwebtoken"
import { REFRESH_TOKEN_KEY, REFRESH_TOKEN_TTL_SECONDS } from "common/constant"
import { getRefreshCookieOptions } from "common/cookie"
import redis from "common/redis"
import { requireAuth, AuthenticatedRequest } from "middleware/auth"

const router = Router()

const JWT_SECRET = process.env.JWT_SECRET!
const JWT_ISSUER = process.env.JWT_ISSUER?.trim() || "localhost:8000"

/**
 * @swagger
 * /api/tool/make-expired:
 *   post:
 *     summary: make the current access token expire in 1 second and remove refresh token cookie
 *     description: >
 *       Takes the currently valid access token and signs a new one with the same
 *       payload but an expiry of now + 1 second.<br />The signature stays valid; the
 *       token simply expires right after, and also removes the refresh token cookie to prevent silent re-auth.<br />
 *       This is intended for testing and development purposes, not for regular client usage.
 *     tags:
 *       - Tool
 *     security:
 *       - basicAuth: []
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: New short-lived access token issued (raw JWT string)
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *       401:
 *         description: Unauthorized (missing, invalid, or expired token)
 */
router.post("/tool/make-expired", requireAuth(), async (req: AuthenticatedRequest, res: Response) => {
	// Reuse the verified payload from the current token, dropping the registered
	// claims so jwt.sign can set fresh ones.
	const { iat, exp, iss, ...restPayload } = req.auth!.payload ?? {}

	const access_token = jwt.sign(restPayload, JWT_SECRET, {
		expiresIn: 1, // seconds: token expires 1s from now, signature stays valid
		issuer: JWT_ISSUER
	})

	const options = getRefreshCookieOptions(REFRESH_TOKEN_TTL_SECONDS * 1000)
	res.clearCookie(REFRESH_TOKEN_KEY, options)
	
	await redis.del(`${REFRESH_TOKEN_KEY}:${req.auth!.userId}:${req.auth!.sessionId}`)

	res.status(200).type("text/plain").send(access_token)
})

export default router
