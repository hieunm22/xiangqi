import { Request, Response, Router, urlencoded } from "express"
import crypto from "crypto"
import multer from "multer"
import jwt from "jsonwebtoken"
import prisma from "prisma"
import {
	ACCESS_TOKEN_EXPIRES_IN,
	LOGIN_SESSION_KEY,
	REFRESH_TOKEN_KEY,
	REFRESH_TOKEN_TTL_SECONDS
} from "common/constant"
import redis from "common/redis"
import { getRefreshCookieOptions } from "common/cookie"
import {
  LoginRequest,
  LoginSuccessResponse,
  LoginSession
} from "types/auth.type"

const router = Router()
const upload = multer()

const JWT_SECRET = process.env.JWT_SECRET!
const JWT_ISSUER = process.env.JWT_ISSUER?.trim() || "localhost:8000"

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Authenticate user
 *     tags:
 *       - Auth
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *               - timezoneOffset
 *               - deviceName
 *             properties:
 *               username:
 *                 type: string
 *               password:
 *                 type: string
 *               timezoneOffset:
 *                 type: number
 *               deviceName:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: login.messages.success
 *                 status_code:
 *                   type: integer
 *                   example: 200
 *                 access_token:
 *                   type: string
 *                   description: JWT token to be used in Authorization header for subsequent requests
 *                 refresh_token:
 *                   type: string
 *                   description: Refresh token stored in httpOnly cookie and response
 *                 token_type:
 *                   type: string
 *                   example: Bearer
 *       400:
 *         description: Missing credentials
 *       401:
 *         description: Incorrect username or password
 *       500:
 *         description: Internal server error
 */
router.post("/auth/login", (req, res, next) => {
	const contentType = req.headers["content-type"] ?? ""
	if (contentType.includes("application/x-www-form-urlencoded")) {
		return urlencoded({ extended: false })(req, res, next)
	}
	return upload.none()(req, res, next)
}, async (req: Request, res: Response) => {
	const {
    username,
    password,
    timezoneOffset,
    deviceName
  } = req.body as LoginRequest

	if (!username?.trim() || !password?.trim()) {
		res.status(400).json({
			success: false,
			message: "login.messages.missing-credentials",
			status_code: 400,
			access_token: "",
			refresh_token: "",
			token_type: "Bearer"
		} as LoginSuccessResponse)
		return
	}

	try {
		const hashedPassword = crypto
				.createHash("md5")
				.update(password + process.env.JWT_SECRET)
				.digest("hex")
				.toUpperCase()

		const orConditions: any[] = [
			{ user_name: username },
			{ email: username }
		]
		
		// Only add id condition if username is a valid number
		const numId = Number(username)
		if (!isNaN(numId) && Number.isInteger(numId)) {
			orConditions.unshift({ id: numId })
		}

		const user = await prisma.user.findFirst({
			where: {
				OR: orConditions,
				password: hashedPassword
			},
			select: { id: true, user_name: true }
		})

		if (!user) {
			res.status(401).json({
				success: false,
				message: "login.messages.incorrect-login",
				status_code: 401,
				access_token: "",
				refresh_token: "",
        token_type: "Bearer"
			} as LoginSuccessResponse)
			return
		}

		const sessionId = crypto.randomUUID()
		const payload = {
			sub: Number(user.id),
			jti: sessionId,
			timezoneOffset: Number(timezoneOffset ?? 0)
		}

		const access_token = jwt.sign(payload, JWT_SECRET, {
			expiresIn: ACCESS_TOKEN_EXPIRES_IN,
			issuer: JWT_ISSUER
		})

		// Keep login session valid for the full refresh window.
		const sessionValue = JSON.stringify({
			userId: Number(user.id),
			deviceName: deviceName?.trim() || "",
			clientId: sessionId,
			createdAt: new Date().toISOString(),
			isValid: true
		} as LoginSession)
		await redis.set(`${LOGIN_SESSION_KEY}:${user.id}:${sessionId}`, sessionValue, "EX", REFRESH_TOKEN_TTL_SECONDS)

		// refresh_token should be a guid id
		const refresh_token = crypto.randomUUID()

		// Store refresh token in Redis with key refresh-token:<user-id>:<session-id>, expiration 30 days
		await redis.set(`${REFRESH_TOKEN_KEY}:${user.id}:${sessionId}`, refresh_token, "EX", REFRESH_TOKEN_TTL_SECONDS)

		// On a user's very first login, seed an announcement "read" baseline so a
		// brand-new user is treated as caught up with existing announcements while
		// still seeing announcements created afterwards as unread. Non-critical:
		// never block login if this fails.
		try {
			const existingRead = await prisma.userAnnouncementRead.findFirst({
				where: { user_id: user.id },
				select: { id: true }
			})

			if (!existingRead) {
				await prisma.userAnnouncementRead.create({
					data: { user_id: user.id, session_id: sessionId }
				})
			}
		} catch (seedError) {
			console.error("Failed to seed announcement read baseline:", seedError)
		}

		const cookieOptions = getRefreshCookieOptions(REFRESH_TOKEN_TTL_SECONDS * 1000)
		res.cookie(REFRESH_TOKEN_KEY, refresh_token, cookieOptions)

		res.status(200).json({
			success: true,
			message: "login.messages.success",
			status_code: 200,
			access_token,
			refresh_token,
      token_type: "Bearer"
		})
	} catch (err) {
		console.error("Login error:", err)
		res.status(500).json({
			success: false,
			message: "login.messages.internal-server-error",
			status_code: 500,
			access_token: "",
			refresh_token: "",
			token_type: "Bearer"
		})
	}
})

export default router
