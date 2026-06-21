import { Response, Router } from "express"
import prisma from "prisma"
import { getAvatarUrl } from "common/helper"
import { getChatMessageCollection } from "common/mongodb"
import { emitAnnouncement } from "common/socket"
import { requireAuth, AuthenticatedRequest } from "middleware/auth"

const router = Router()

/**
 * @swagger
 * /api/message/send-announcement:
 *   post:
 *     summary: Send an announcement
 *     tags:
 *       - Message
 *     security:
 *       - basicAuth: []
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - message
 *             properties:
 *               message:
 *                 type: string
 *     responses:
 *       201:
 *         description: Announcement sent successfully
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.post("/message/send-announcement", requireAuth(), async (req: AuthenticatedRequest, res: Response) => {
	const senderId = Number(req.auth?.userId)
	const { message } = req.body

	if (!message || typeof message !== "string" || message.trim().length === 0) {
		res.status(400).json({
			success: false,
			message: "Invalid message",
			status_code: 400
		})
		return
	}

	try {
		const timestamp = new Date()
		const payload = {
			type: "announcement",
			sender_id: senderId,
			message: message.trim(),
			timestamp
		}

		const collection = await getChatMessageCollection()
		const result = await collection.insertOne(payload)

		const user = await prisma.user.findUnique({
			where: { id: BigInt(senderId) },
			select: { id: true, display_name: true, avatar_seq: true }
		})

		const announcementData = {
			_id: result.insertedId.toString(),
			sender: user ? {
				id: Number(user.id),
				display_name: user.display_name,
				avatar_url: getAvatarUrl(user.id, user.avatar_seq)
			} : null,
			message: payload.message,
			timestamp: timestamp.toISOString()
		}

		// Broadcast to every connected client so their announcement badge /
		// open announcement screen updates in real time.
		emitAnnouncement(announcementData, senderId)

		res.status(201).json({
			success: true,
			message: "Success",
			status_code: 201,
			data: announcementData
		})
	} catch (error) {
		console.error("Send announcement error:", error)
		res.status(500).json({
			success: false,
			message: "Internal server error",
			status_code: 500
		})
	}
})

export default router
