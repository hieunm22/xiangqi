import { Request, Response, Router } from "express"
import crypto from "crypto"
import prisma from "prisma"
import { FORGOT_PASSWORD_KEY } from "common/constant"
import redis from "common/redis"
import { ResetPasswordRequest } from "types/auth.type"

const router = Router()

/**
 * @swagger
 * /api/auth/reset-password:
 *   get:
 *     summary: Validate reset password token
 *     tags:
 *       - Auth
 *     security: []
 *     parameters:
 *       - in: query
 *         name: id
 *         required: true
 *         schema:
 *           type: number
 *       - in: query
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Reset password token is valid
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
 *                   example: reset-password.messages.token-valid
 *                 status_code:
 *                   type: integer
 *                   example: 200
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
 *       400:
 *         description: Missing id or token, or invalid user id
 *       401:
 *         description: Invalid or expired token
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
router.get("/auth/reset-password", async (req: Request, res: Response) => {
	const { id, token } = req.query

	if (!id || !token) {
		res.status(400).json({
			success: false,
			message: "reset-password.messages.missing-id-or-token",
			status_code: 400,
			data: null
		})
		return
	}

	try {
		const userId = parseInt(id as string, 10)

		if (isNaN(userId)) {
			res.status(400).json({
				success: false,
				message: "reset-password.messages.invalid-user-id",
				status_code: 400,
				data: null
			})
			return
		}

		// Check if token matches in cache
		const cachedToken = await redis.get(`${FORGOT_PASSWORD_KEY}:${userId.toString()}`)

		if (!cachedToken || cachedToken !== token) {
			res.status(401).json({
				success: false,
				message: "reset-password.messages.invalid-or-expired-token",
				status_code: 401,
				data: null
			})
			return
		}

		// Fetch user to return
		const user = await prisma.user.findUnique({
			where: { id: BigInt(userId) },
			select: {
				id: true,
				user_name: true,
				email: true,
				display_name: true,
				gender: true
			}
		})

		if (!user) {
			res.status(404).json({
				success: false,
				message: "reset-password.messages.user-not-found",
				status_code: 404,
				data: null
			})
			return
		}

		res.status(200).json({
			success: true,
			message: "reset-password.messages.token-valid",
			status_code: 200,
			data: {
				id: Number(user.id),
				user_name: user.user_name,
				email: user.email,
				display_name: user.display_name,
				gender: user.gender
			}
		})
	} catch (error) {
		console.error("Reset password validation error:", error)
		res.status(500).json({
			success: false,
			message: "reset-password.messages.internal-server-error",
			status_code: 500,
			data: null
		})
	}
})

/**
 * @swagger
 * /api/auth/reset-password:
 *   post:
 *     summary: Reset user password
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
 *               - userId
 *               - password
 *             properties:
 *               userId:
 *                 type: number
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password reset successfully
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
 *                   example: reset-password.messages.success
 *                 status_code:
 *                   type: integer
 *                   example: 200
 *       400:
 *         description: Missing userId or password, or invalid user id
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
router.post("/auth/reset-password", async (req: Request, res: Response) => {
	const { userId, password } = req.body as Partial<ResetPasswordRequest>
	const normalizedUserId = String(userId ?? "").trim()
	const normalizedPassword = String(password ?? "").trim()

	if (!normalizedUserId || !normalizedPassword) {
		res.status(400).json({
			success: false,
			message: "reset-password.messages.missing-userId-or-password",
			status_code: 400
		})
		return
	}

	try {
		const parsedUserId = Number.parseInt(normalizedUserId, 10)

		if (Number.isNaN(parsedUserId) || parsedUserId <= 0) {
			res.status(400).json({
				success: false,
				message: "reset-password.messages.invalid-user-id",
				status_code: 400
			})
			return
		}

		// Check if user exists
		const user = await prisma.user.findUnique({
			where: { id: BigInt(parsedUserId) },
			select: { id: true }
		})

		if (!user) {
			res.status(404).json({
				success: false,
				message: "reset-password.messages.user-not-found",
				status_code: 404
			})
			return
		}

		// Hash password with salt
		const hashedPassword = crypto
			.createHash("md5")
			.update(normalizedPassword + process.env.JWT_SECRET)
			.digest("hex")
			.toUpperCase()

		// Update password in database
		await prisma.user.update({
			where: { id: BigInt(parsedUserId) },
			data: { password: hashedPassword }
		})

		// Clear the reset password token from cache
		await redis.del(`${FORGOT_PASSWORD_KEY}:${parsedUserId.toString()}`)

		res.status(200).json({
			success: true,
			message: "reset-password.messages.success",
			status_code: 200
		})
	} catch (error) {
		console.error("Reset password error:", error)
		res.status(500).json({
			success: false,
			message: "reset-password.messages.internal-server-error",
			status_code: 500
		})
	}
})

export default router
