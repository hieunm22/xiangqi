import crypto from "crypto"
import { Request, Response, Router } from "express"
import jwt from "jsonwebtoken"
import multer from "multer"
import { Pool } from "pg"

const router = Router()
const upload = multer()

const pool = new Pool({
	connectionString: process.env.DATABASE_URL
})

const JWT_SECRET = process.env.JWT_SECRET!
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET!

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
				.update(password)
				.digest("hex")
				.toUpperCase()

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
		const payload = {
				id: user.id,
				username: user.user_name,
				timezoneOffset: Number(timezoneOffset ?? 0)
		}

		const access_token = jwt.sign(payload, JWT_SECRET, { expiresIn: "15m" })
		const refresh_token = jwt.sign({ id: user.id }, JWT_REFRESH_SECRET, { expiresIn: "7d" })

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