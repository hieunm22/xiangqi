import { Response, Router } from "express"
import crypto from "crypto"
import prisma from "prisma"
import { isPasswordPolicyMet } from "common/password"
import { requireAuth, AuthenticatedRequest } from "middleware/auth"
import { ChangePasswordRequest } from "types/auth.type"

const router = Router()

const hashPassword = (password: string): string =>
	crypto
		.createHash("md5")
		.update(password + process.env.JWT_SECRET)
		.digest("hex")
		.toUpperCase()

/**
 * @swagger
 * /api/auth/change-password:
 *   post:
 *     summary: Change the authenticated user's password
 *     tags:
 *       - Auth
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *               - newPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *               newPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password changed successfully
 *       400:
 *         description: Missing fields, weak new password, or new password same as current
 *       401:
 *         description: Unauthorized or current password incorrect
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
router.post("/auth/change-password", requireAuth(), async (req: AuthenticatedRequest, res: Response) => {
	const { currentPassword, newPassword } = req.body as Partial<ChangePasswordRequest>
	const normalizedCurrentPassword = String(currentPassword ?? "").trim()
	const normalizedNewPassword = String(newPassword ?? "").trim()

	if (!normalizedCurrentPassword || !normalizedNewPassword) {
		res.status(400).json({
			success: false,
			message: "change-password.messages.missing-fields",
			status_code: 400
		})
		return
	}

	if (!isPasswordPolicyMet(normalizedNewPassword)) {
		res.status(400).json({
			success: false,
			message: "change-password.messages.weak-password",
			status_code: 400
		})
		return
	}

	try {
		const userId = Number(req.auth?.userId)

		const user = await prisma.user.findUnique({
			where: { id: BigInt(userId) },
			select: { id: true, password: true }
		})

		if (!user) {
			res.status(404).json({
				success: false,
				message: "change-password.messages.user-not-found",
				status_code: 404
			})
			return
		}

		if (hashPassword(normalizedCurrentPassword) !== user.password) {
			res.status(401).json({
				success: false,
				message: "change-password.messages.incorrect-current-password",
				status_code: 401
			})
			return
		}

		if (normalizedNewPassword === normalizedCurrentPassword) {
			res.status(400).json({
				success: false,
				message: "change-password.messages.same-as-current",
				status_code: 400
			})
			return
		}

		await prisma.user.update({
			where: { id: BigInt(userId) },
			data: { password: hashPassword(normalizedNewPassword) }
		})

		res.status(200).json({
			success: true,
			message: "change-password.messages.success",
			status_code: 200
		})
	} catch (error) {
		console.error("Change password error:", error)
		res.status(500).json({
			success: false,
			message: "change-password.messages.internal-server-error",
			status_code: 500
		})
	}
})

export default router
