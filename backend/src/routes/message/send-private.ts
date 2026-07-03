import { Response, Router } from "express"
import prisma from "prisma"
import { getAvatarUrl, getConversationKey } from "common/helper"
import { getChatMessageCollection } from "common/mongodb"
import { emitPrivateMessage } from "common/socket"
import { requireAuth, AuthenticatedRequest } from "middleware/auth"

const router = Router()

/**
 * @swagger
 * /api/message/send-private:
 *   post:
 *     summary: Send a private message to another user
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
 *               - receiver_id
 *             properties:
 *               message:
 *                 type: string
 *                 description: The message content
 *               receiver_id:
 *                 type: number
 *                 description: The ID of the user receiving the message
 *     responses:
 *       201:
 *         description: Message sent successfully
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
 *                   example: Success
 *                 status_code:
 *                   type: integer
 *                   example: 201
 *                 data:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                       description: Message ID (UUID)
 *                     message:
 *                       type: string
 *                     sender_id:
 *                       type: number
 *                     receiver_id:
 *                       type: number
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.post("/message/send-private", requireAuth(), async (req: AuthenticatedRequest, res: Response) => {
	const senderId = Number(req.auth?.userId)
	const { message, receiver_id } = req.body

	// Validate input
	if (!message || typeof message !== "string" || message.trim().length === 0) {
		res.status(400).json({
			success: false,
			message: "Invalid message",
			status_code: 400
		})
		return
	}

	if (!Number.isInteger(receiver_id) || receiver_id <= 0) {
		res.status(400).json({
			success: false,
			message: "Invalid receiver_id",
			status_code: 400
		})
		return
	}

	if (senderId === receiver_id) {
		res.status(400).json({
			success: false,
			message: "Cannot send message to yourself",
			status_code: 400
		})
		return
	}

	try {
		// Verify receiver exists
		const receiver = await prisma.user.findUnique({
			where: { id: BigInt(receiver_id) },
			select: { id: true }
		})

		if (!receiver) {
			res.status(400).json({
				success: false,
				message: "Receiver not found",
				status_code: 400
			})
			return
		}

		// Calculate conversation_key: min_id_max_id
		const conversationKey = getConversationKey(senderId, receiver_id)

		// Insert into MongoDB chat_history collection
		const collection = await getChatMessageCollection()
		const result = await collection.insertOne({
			type: "private",
			message: message.trim(),
			sender_id: senderId,
			receiver_id,
			conversation_key: conversationKey,
			timestamp: new Date(),
			seen: false
		})

		const sender = await prisma.user.findUnique({
			where: { id: BigInt(senderId) },
			select: { id: true, display_name: true, avatar_seq: true }
		})

		const responseData = {
			_id: result.insertedId.toString(),
			message: message.trim(),
			conversation_key: conversationKey,
			sender: sender ? {
				id: Number(sender.id),
				display_name: sender.display_name,
				avatar_url: getAvatarUrl(sender.id, sender.avatar_seq)
			} : null,
			receiver_id,
			seen: false,
			timestamp: new Date().toISOString()
		}

		// Notify the receiver in real time so their conversation list / unread
		// badge updates without a reload.
		emitPrivateMessage(receiver_id, responseData)

		res.status(201).json({
			success: true,
			message: "Success",
			status_code: 201,
			data: responseData
		})
	} catch (error) {
		console.error("Send private message error:", error)
		res.status(500).json({
			success: false,
			message: "Internal server error",
			status_code: 500
		})
	}
})

export default router
