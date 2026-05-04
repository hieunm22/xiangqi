import { Request, Response, Router } from "express"
import Redis from "ioredis"
import jwt from "jsonwebtoken"
import { LOGIN_SESSION_KEY } from "../../common/constant"

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
router.post("/auth/validate-token", async (req: Request, res: Response) => {
	const authHeader = req.headers.authorization
	const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined

	if (!token?.trim()) {
		res.status(401).json({ success: false, message: "Token not provided", reason: "token_missing", status_code: 401 })
		return
	}

	const decoded = jwt.decode(token) as { sub?: number; jti?: string } | null
	if (!decoded) {
		res.status(401).json({ success: false, message: "Token is not a valid JWT", reason: "token_malformed", status_code: 401 })
		return
	}

	try {
		const verified = jwt.verify(token, JWT_SECRET, { issuer: JWT_ISSUER }) as jwt.JwtPayload
		const userId = verified.sub
		const sessionId = verified.jti

		if (!userId || !sessionId) {
			res.status(401).json({ success: false, message: "Invalid token payload", reason: "payload_invalid", status_code: 401 })
			return
		}

		const sessionKey = `${LOGIN_SESSION_KEY}:${userId}:${sessionId}`
		const sessionRaw = await redis.get(sessionKey)
		if (!sessionRaw) {
			res.status(401).json({ success: false, message: "Session not found", reason: "session_not_found", status_code: 401 })
			return
		}

		let sessionUserId: number | undefined
		try {
			sessionUserId = JSON.parse(sessionRaw).userId
		} catch {
			sessionUserId = undefined
		}

		if (Number(sessionUserId) !== Number(userId)) {
			res.status(401).json({ success: false, message: "Token subject mismatch", reason: "subject_mismatch", status_code: 401 })
			return
		}

		res.status(200).json({ success: true, message: "Token is valid", status_code: 200 })
	} catch (error) {
		if (error instanceof jwt.TokenExpiredError) {
			res.status(401).json({ success: false, message: "Token is expired", reason: "expired", status_code: 401 })
			return
		}

		if (error instanceof jwt.NotBeforeError) {
			res.status(401).json({ success: false, message: "Token is not active yet", reason: "not_active", status_code: 401 })
			return
		}

		if (error instanceof jwt.JsonWebTokenError) {
			const reason = error.message === "invalid signature" ? "invalid_signature" : "jwt_invalid"
			res.status(401).json({ success: false, message: error.message || "Token is invalid", reason, status_code: 401 })
			return
		}

		res.status(401).json({ success: false, message: "Token validation failed", reason: "validation_failed", status_code: 401 })
	}
})

export default router
