import { Request, Response, Router, urlencoded } from "express"
import crypto from "crypto"
import multer from "multer"
import prisma from "prisma"
import { establishUserSession } from "./_session"
import { LoginRequest, LoginSuccessResponse } from "types/auth.type"

const router = Router()
const upload = multer()

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

		const response = await establishUserSession(res, {
			userId: Number(user.id),
			timezoneOffset: Number(timezoneOffset ?? 0),
			deviceName
		})

		res.status(200).json(response)
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
