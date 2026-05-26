import { Request, Response, NextFunction } from "express"
import jwt from "jsonwebtoken"
import { LOGIN_SESSION_KEY } from "common/constant"
import redis from "common/redis"

const JWT_SECRET = process.env.JWT_SECRET!
const JWT_ISSUER = process.env.JWT_ISSUER?.trim() || "localhost:8000"

export interface AuthenticatedRequest extends Request {
	auth?: {
		userId: string
		sessionId: string
		payload?: jwt.JwtPayload
	}
}

export const requireAuth = (ignoreExpiration?: boolean) => {
	return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
		const authHeader = req.headers.authorization
		const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined

		if (!token?.trim()) {
			res.status(401).json({
				success: false,
				message: "auth-middleware.messages.token-required",	// Token is required
				status_code: 401
			})
			return
		}

		try {
			const options: jwt.VerifyOptions = { 
				issuer: JWT_ISSUER,
				ignoreExpiration
			}
			const payload = jwt.verify(token, JWT_SECRET, options) as jwt.JwtPayload
			const userId = payload.sub
			const sessionId = payload.jti

			if (!userId || !sessionId) {
				res.status(401).json({
					success: false,
					message: "auth-middleware.messages.invalid-token-payload",	// Invalid token payload
					status_code: 401
				})
				return
			}

			const sessionKey = `${LOGIN_SESSION_KEY}:${userId}:${sessionId}`
			const sessionRaw = await redis.get(sessionKey)
			if (!sessionRaw) {
				res.status(401).json({
					success: false,
					message: "auth-middleware.messages.session-not-found",	// Session not found
					status_code: 401
				})
				return
			}

			let sessionUserId: number | undefined
			try {
				sessionUserId = JSON.parse(sessionRaw).userId
			} catch {
				sessionUserId = undefined
			}

			if (Number(sessionUserId) !== Number(userId)) {
				res.status(401).json({
					success: false,
					message: "auth-middleware.messages.token-subject-mismatch",	// Token subject mismatch
					status_code: 401
				})
				return
			}

			req.auth = {
				payload,
				userId: String(userId),
				sessionId: String(sessionId)
			}

			next()
		} catch (error) {
			if (error instanceof jwt.TokenExpiredError && !ignoreExpiration) {
				res.status(401).json({
					success: false,
					message: "auth-middleware.messages.token-expired",	// Token is expired
					status_code: 401
				})
				return
			}

			if (error instanceof jwt.JsonWebTokenError || error instanceof jwt.NotBeforeError) {
				res.status(401).json({
					success: false,
					message: "auth-middleware.messages.token-invalid",	// Token is invalid
					status_code: 401
				})
				return
			}

			res.status(401).json({
				success: false,
				message: "auth-middleware.messages.token-validation-failed",	// Token validation failed
				status_code: 401
			})
		}
	}
}
