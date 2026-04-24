import { Request, Response, Router } from "express"
import crypto from "crypto"
import { Pool } from "pg"
import Redis from "ioredis"
import jwt from "jsonwebtoken"
import multer from "multer"

const router = Router()
const upload = multer()

const databaseUrl = process.env.DATABASE_URL?.trim()
if (!databaseUrl) {
	throw new Error("DATABASE_URL is not set")
}

let parsedDbUrl: URL
try {
	parsedDbUrl = new URL(databaseUrl)
} catch {
	throw new Error("DATABASE_URL is not a valid URL")
}

if (!parsedDbUrl.password) {
	throw new Error("DATABASE_URL must include a database password")
}

const pool = new Pool({
	connectionString: databaseUrl
})

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

		console.log('hashedPassword :>> ', hashedPassword);

		const result = await pool.query<{ id: number; user_name: string }>(
			"SELECT id, user_name FROM auth.users WHERE (user_name = $1 OR id = $1::int OR email = $1) AND password = $2",
			[username, hashedPassword]
		)

		if (result.rows.length === 0) {
			res.status(401).json({
				success: false,
				error: "Invalid username or password",
				status_code: 401,
				access_token: "",
				refresh_token: ""
			})
			return
		}

		const user = result.rows[0]
		const sessionId = crypto.randomUUID()
		const payload = {
			sub: user.id,
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
		await redis.set(`login-session:${user.id}`, refresh_token, "EX", 30 * 24 * 60 * 60)
		
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
