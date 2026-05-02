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
 *               type: string
 *               description: JWT access token
 *       401:
 *         description: Unauthorized
 */
router.post("/auth/refresh-token", async (req: Request, res: Response) => {
	const refreshTokenCookie = req.cookies?.["refresh-token"]
	const authHeader = req.headers.authorization

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

	if (!authHeader?.startsWith("Bearer ")) {
		res.status(401).json({
			success: false,
			message: "Missing or invalid Authorization header",
			status_code: 401,
			access_token: "",
			token_type: "Bearer"
		})
		return
	}

	const expiredToken = authHeader.slice(7)

	let payload: jwt.JwtPayload
	try {
		payload = jwt.verify(expiredToken, JWT_SECRET, {
			issuer: JWT_ISSUER,
			ignoreExpiration: true
		}) as jwt.JwtPayload
	} catch {
		res.status(401).json({
			success: false,
			message: "Invalid access token",
			status_code: 401,
			access_token: "",
			token_type: "Bearer"
		})
		return
	}

	const userId = payload.sub
	const sessionId = payload.jti

	if (!userId || !sessionId) {
		res.status(401).json({
			success: false,
			message: "Invalid token payload",
			status_code: 401,
			access_token: "",
			token_type: "Bearer"
		})
		return
	}

	const cachedRefreshToken = await redis.get(`refresh-token:${userId}:${sessionId}`)

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
	const { iat, exp, iss, ...restPayload } = payload
	const access_token = jwt.sign(restPayload, JWT_SECRET, {
		expiresIn: "1h",
		issuer: JWT_ISSUER
	})

	res.status(200).json(access_token)
})

export default router
