import { Request, Response, Router } from "express"
import crypto from "crypto"
import prisma from "prisma"
import { RegisterRequest } from "types/auth.type"

const router = Router()

function parseGender(value: RegisterRequest["gender"]): boolean | null {
	if (typeof value === "boolean") {
		return value
	}

	if (typeof value === "number") {
		if (value === 1) {
			return true
		}
		if (value === 0) {
			return false
		}
		return null
	}

	if (typeof value === "string") {
		const normalized = value.trim().toLowerCase()
		if (["true", "1", "male", "m"].includes(normalized)) {
			return true
		}
		if (["false", "0", "female", "f"].includes(normalized)) {
			return false
		}
	}

	return null
}

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Create a new user
 *     tags:
 *       - Auth
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *               - gender
 *               - displayName
 *               - email
 *             properties:
 *               username:
 *                 type: string
 *               password:
 *                 type: string
 *               gender:
 *                 oneOf:
 *                   - type: boolean
 *                   - type: string
 *               displayName:
 *                 type: string
 *               email:
 *                 type: string
 *     responses:
 *       201:
 *         description: User created
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
 *                   example: register.messages.success
 *                 status_code:
 *                   type: integer
 *                   example: 201
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                     user_name:
 *                       type: string
 *                     email:
 *                       type: string
 *                     display_name:
 *                       type: string
 *                     gender:
 *                       type: boolean
 *                     avatar_seq:
 *                       type: integer
 *       400:
 *         description: Invalid request body
 *       409:
 *         description: Duplicate user_name or email
 *       500:
 *         description: Internal server error
 */
router.post("/auth/register", async (req: Request, res: Response) => {
	const body = req.body as RegisterRequest
	const username = (body.username ?? body.user_name ?? "").trim()
	const password = (body.password ?? "").trim()
	const email = (body.email ?? "").trim().toLowerCase()
	const displayName = (body.displayName ?? body.display_name ?? "").trim()
	const gender = parseGender(body.gender)

	if (!username || !password || !email || !displayName || gender === null) {
		res.status(400).json({
			success: false,
			message: "register.messages.missing-fields",
			status_code: 400
		})
		return
	}

	try {
		const [existingUsername, existingEmail] = await Promise.all([
			prisma.user.findUnique({ where: { user_name: username }, select: { id: true } }),
			prisma.user.findUnique({ where: { email }, select: { id: true } })
		])

		if (existingUsername) {
			res.status(409).json({
				success: false,
				message: "register.messages.username-exists",
				status_code: 409
			})
			return
		}

		if (existingEmail) {
			res.status(409).json({
				success: false,
				message: "register.messages.email-exists",
				status_code: 409
			})
			return
		}

		const hashedPassword = crypto
			.createHash("md5")
			.update(password + process.env.JWT_SECRET)
			.digest("hex")
			.toUpperCase()

		const createdUser = await prisma.user.create({
			data: {
				user_name: username,
				password: hashedPassword,
				gender,
				display_name: displayName,
				email
			},
			select: {
				id: true,
				user_name: true,
				email: true,
				display_name: true,
				gender: true,
				avatar_seq: true
			}
		})

		res.status(201).json({
			success: true,
			message: "register.messages.success",
			status_code: 201,
			data: {
				id: Number(createdUser.id),
				user_name: createdUser.user_name,
				email: createdUser.email,
				display_name: createdUser.display_name,
				gender: createdUser.gender,
				avatar_seq: createdUser.avatar_seq
			}
		})
	} catch (error: any) {
		// Handle race condition when two requests pass duplicate check at the same time.
		if (error?.code === "P2002") {
			const target = Array.isArray(error?.meta?.target) ? error.meta.target.join(",") : String(error?.meta?.target ?? "")
			if (target.includes("user_name")) {
				res.status(409).json({
					success: false,
					message: "register.messages.username-exists",
					status_code: 409
				})
				return
			}
			if (target.includes("email")) {
				res.status(409).json({
					success: false,
					message: "register.messages.email-exists",
					status_code: 409
				})
				return
			}
		}

		console.error("Register error:", error)
		res.status(500).json({
			success: false,
			message: "register.messages.internal-server-error",
			status_code: 500
		})
	}
})

export default router
