import { Request, Response, Router } from "express"
import crypto from "crypto"
import Redis from "ioredis"
import jwt from "jsonwebtoken"
import multer from "multer"
import prisma from "../prisma"
import { LoginRequest, LoginResponse, LoginSession } from "../types/auth.type"

const router = Router()
const upload = multer()

const JWT_SECRET = process.env.JWT_SECRET!
const JWT_ISSUER = process.env.JWT_ISSUER?.trim() || "localhost:8000"

const redis = new Redis({
	host: process.env.REDIS_HOST?.trim() || "localhost",
	port: Number(process.env.REDIS_PORT) || 6379,
	db: 4
})

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Authenticate user
 *     tags:
 *       - Auth
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
 *                 message:
 *                   type: string
 *                 status_code:
 *                   type: integer
 *                 access_token:
 *                   type: string
 *                 refresh_token:
 *                   type: string
 *       401:
 *         description: Invalid credentials
 *       500:
 *         description: Internal server error
 */
router.post("/auth/login", upload.none(), async (req: Request, res: Response) => {
	const {
    username,
    password,
    timezoneOffset,
    deviceName
  } = req.body as LoginRequest

	if (!username?.trim() || !password?.trim()) {
		res.status(400).json({
			success: false,
			message: "Username and password are required",
			status_code: 400,
			access_token: "",
			refresh_token: "",
      token_type: "Bearer"
		} as LoginResponse)
		return
	}

	try {
		const hashedPassword = crypto
				.createHash("md5")
				.update(password + process.env.JWT_SECRET)
				.digest("hex")
				.toUpperCase()

		const user = await prisma.user.findFirst({
			where: {
				OR: [
					{ id: Number(username) },
					{ user_name: username },
					{ email: username }
				],
				password: hashedPassword
			},
			select: { id: true, user_name: true }
		})

		if (!user) {
			res.status(401).json({
				success: false,
				message: "Invalid username or password",
				status_code: 401,
				access_token: "",
				refresh_token: "",
        token_type: "Bearer"
			} as LoginResponse)
			return
		}

		const sessionId = crypto.randomUUID()
		const payload = {
			sub: Number(user.id),
			jti: sessionId,
			timezoneOffset: Number(timezoneOffset ?? 0)
		}

		const access_token = jwt.sign(payload, JWT_SECRET, {
			expiresIn: "1h",
			issuer: JWT_ISSUER
		})

		// Store session in Redis with key login-session:<user-id>:<session-id>, expiration in 1h
		const sessionValue = JSON.stringify({
			userId: Number(user.id),
			deviceName: deviceName?.trim() || "",
			clientId: sessionId,
			createdAt: new Date().toISOString(),
			isValid: true
		} as LoginSession)
		await redis.set(`login-session:${user.id}:${sessionId}`, sessionValue, "EX", 60 * 60)

		// refresh_token should be a guid id
		const refresh_token = crypto.randomUUID()
		// Store refresh token in Redis with key refresh-token:<user-id>:<session-id>, expiration 30 days
		await redis.set(`refresh-token:${user.id}:${sessionId}`, refresh_token, "EX", 30 * 24 * 60 * 60)
		
		res.status(200).json({
			success: true,
			message: "Login successful",
			status_code: 200,
			access_token,
			refresh_token,
      token_type: "Bearer"
		})
	} catch (err) {
		console.error("Login error:", err)
		res.status(500).json({
			success: false,
			message: "Internal server error",
			status_code: 500,
			access_token: "",
			refresh_token: "",
      token_type: "Bearer"
		})
	}
})

export default router
