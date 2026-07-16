import { Request, Response, NextFunction } from "express"
import crypto from "crypto"

// Constant-time comparison over fixed-length digests
const safeEqual = (a: string, b: string): boolean => {
	const ha = crypto.createHash("sha256").update(a).digest()
	const hb = crypto.createHash("sha256").update(b).digest()
	return crypto.timingSafeEqual(ha, hb)
}

/**
 * Protects internal tool endpoints with a shared API key.
 */
export const requireApiKey = () => {
	return (req: Request, res: Response, next: NextFunction) => {
		const expected = process.env.TOOL_API_KEY?.trim()

		if (!expected) {
			res.status(500).json({
				success: false,
				message: "api-key-middleware.messages.not-configured",	// API key is not configured on the server
				status_code: 500
			})
			return
		}

		const header = req.headers["x-api-key"]
		const provided = (Array.isArray(header) ? header[0] : header)?.trim()

		if (!provided || !safeEqual(provided, expected)) {
			res.status(401).json({
				success: false,
				message: "api-key-middleware.messages.unauthorized",	// Invalid or missing API key
				status_code: 401
			})
			return
		}

		next()
	}
}
