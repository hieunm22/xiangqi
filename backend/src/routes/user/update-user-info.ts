import { Response, Router } from "express"
import multer from "multer"
import prisma from "prisma"
import { getAvatarUrl } from "common/helper"
import { uploadBufferToS3 } from "common/s3"
import { requireAuth, AuthenticatedRequest } from "middleware/auth"

const router = Router()

const MAX_DISPLAY_NAME_LENGTH = 100
const MAX_EMAIL_LENGTH = 255
const MAX_AVATAR_FILE_SIZE = 5 * 1024 * 1024
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const AVATAR_BUCKET_NAME = process.env.AWS_S3_BUCKET?.trim() || "caa-storage"

const upload = multer({
	storage: multer.memoryStorage(),
	limits: {
		fileSize: MAX_AVATAR_FILE_SIZE
	}
})

/**
 * @swagger
 * /api/user/update-info:
 *   patch:
 *     summary: Update authenticated user's profile info
 *     tags:
 *       - User
 *     security:
 *       - basicAuth: []
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               avatar:
 *                 type: string
 *                 format: binary
 *               display_name:
 *                 type: string
 *                 example: New Display Name
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *     responses:
 *       200:
 *         description: Updated user profile fields
 *       400:
 *         description: Invalid payload
 *       401:
 *         description: Unauthorized
 *       409:
 *         description: Email already exists
 *       500:
 *         description: Internal server error
 */
router.patch("/user/update-info", requireAuth(), upload.single("avatar"), async (req: AuthenticatedRequest, res: Response) => {
	try {
		const userId = req.auth?.userId
		if (!userId) {
			res.status(401).json({
				success: false,
				message: "Unauthorized",
				status_code: 401
			})
			return
		}

		const displayNameRaw = req.body?.display_name
		const emailRaw = req.body?.email
		const avatarFile = req.file
		const dataToUpdate: { display_name?: string; email?: string } = {}

		if (displayNameRaw !== undefined) {
			if (typeof displayNameRaw !== "string") {
				res.status(400).json({
					success: false,
					message: "display_name must be a string",
					status_code: 400
				})
				return
			}

			const displayName = displayNameRaw.trim()
			if (!displayName) {
				res.status(400).json({
					success: false,
					message: "display_name cannot be empty",
					status_code: 400
				})
				return
			}

			if (displayName.length > MAX_DISPLAY_NAME_LENGTH) {
				res.status(400).json({
					success: false,
					message: `display_name is too long (max ${MAX_DISPLAY_NAME_LENGTH} characters)`,
					status_code: 400
				})
				return
			}

			dataToUpdate.display_name = displayName
		}

		if (emailRaw !== undefined) {
			if (typeof emailRaw !== "string") {
				res.status(400).json({
					success: false,
					message: "email must be a string",
					status_code: 400
				})
				return
			}

			const email = emailRaw.trim().toLowerCase()
			if (!email) {
				res.status(400).json({
					success: false,
					message: "email cannot be empty",
					status_code: 400
				})
				return
			}

			if (email.length > MAX_EMAIL_LENGTH) {
				res.status(400).json({
					success: false,
					message: `email is too long (max ${MAX_EMAIL_LENGTH} characters)`,
					status_code: 400
				})
				return
			}

			if (!EMAIL_REGEX.test(email)) {
				res.status(400).json({
					success: false,
					message: "Invalid email format",
					status_code: 400
				})
				return
			}

			dataToUpdate.email = email
		}

		if (avatarFile) {
			if (!avatarFile.mimetype.startsWith("image/")) {
				res.status(400).json({
					success: false,
					message: "avatar must be an image file",
					status_code: 400
				})
				return
			}
		}

		if (!Object.keys(dataToUpdate).length && !avatarFile) {
			res.status(400).json({
				success: false,
				message: "At least one field is required",
				status_code: 400
			})
			return
		}

		const currentUser = await prisma.user.findUnique({
			where: { id: BigInt(userId) },
			select: { avatar_seq: true }
		})

		if (!currentUser) {
			res.status(404).json({
				success: false,
				message: "User not found",
				status_code: 404
			})
			return
		}

		if (avatarFile) {
			const nextAvatarSeq = currentUser.avatar_seq + 1
			const key = `images/${userId}_${nextAvatarSeq}.jpg`
			await uploadBufferToS3(
				AVATAR_BUCKET_NAME,
				key,
				avatarFile.buffer,
				avatarFile.mimetype || "image/jpeg"
			)
				; (dataToUpdate as { avatar_seq?: number }).avatar_seq = nextAvatarSeq
		}

		const updatedUser = await prisma.user.update({
			where: { id: BigInt(userId) },
			data: dataToUpdate,
			select: {
				display_name: true,
				email: true,
				avatar_seq: true,
			}
		})

		res.status(200).json({
			success: true,
			message: "Success",
			status_code: 200,
			data: {
				display_name: updatedUser.display_name,
				email: updatedUser.email,
				avatar_seq: updatedUser.avatar_seq,
				avatar_url: getAvatarUrl(BigInt(userId), updatedUser.avatar_seq)
			}
		})
	} catch (error: any) {
		if (error?.code === "P2002") {
			const target = Array.isArray(error?.meta?.target) ? error.meta.target.join(",") : String(error?.meta?.target ?? "")
			if (target.includes("email")) {
				res.status(409).json({
					success: false,
					message: "Email already exists",
					status_code: 409
				})
				return
			}
		}

		console.error("Update user info error:", error)
		res.status(500).json({
			success: false,
			message: "Internal server error",
			status_code: 500
		})
	}
})

export default router
