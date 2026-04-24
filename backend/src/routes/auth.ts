import { Request, Response, Router } from "express"
import crypto from "crypto"
import Redis from "ioredis"
import jwt from "jsonwebtoken"
import multer from "multer"
import prisma from "../prisma"

const router = Router()
const upload = multer()

const JWT_SECRET = process.env.JWT_SECRET!
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET!
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
 *                 error:
 *                   type: string
 *                   nullable: true
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
	const { username, password, timezoneOffset } = req.body as {
		username?: string
		password?: string
		timezoneOffset?: string
	}

	if (!username?.trim() || !password?.trim()) {
		res.status(400).json({
			success: false,
			error: "Username and password are required",
			status_code: 400,
			access_token: "",
			refresh_token: ""
		})
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
				error: "Invalid username or password",
				status_code: 401,
				access_token: "",
				refresh_token: ""
			})
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
		// refresh_token should be a guid id, no need to use JWT_REFRESH_SECRET
		const refresh_token = crypto.randomUUID()

		// Store refresh token in Redis with key login-session:<userid>, expiration 30 days
		await redis.set(`login-session:${user.id.toString()}`, refresh_token, "EX", 30 * 24 * 60 * 60)
		
		res.status(200).json({
			success: true,
			error: null,
			status_code: 200,
			access_token,
			refresh_token
		})
	} catch (err) {
		console.error("Login error:", err)
		res.status(500).json({
			success: false,
			error: "Internal server error",
			status_code: 500,
			access_token: "",
			refresh_token: ""
		})
	}
})

export default router
