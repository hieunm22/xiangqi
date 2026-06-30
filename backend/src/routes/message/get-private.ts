import { Response, Router } from "express"
import { Document } from "mongodb"
import prisma from "prisma"
import { getAvatarUrl, getConversationKey } from "common/helper"
import { getChatMessageCollection } from "common/mongodb"
import { requireAuth, AuthenticatedRequest } from "middleware/auth"

const router = Router()

/**
 * @swagger
 * /api/message/get-private:
 *   get:
 *     summary: Get private messages between two users
 *     tags:
 *       - Message
 *     security:
 *       - basicAuth: []
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: receiver_id
 *         required: true
 *         schema:
 *           type: number
 *         description: The ID of the other user in the conversation
 *     responses:
 *       200:
 *         description: Messages retrieved successfully
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
 *                   example: 200
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                         description: Message ID (MongoDB ObjectId)
 *                       message:
 *                         type: string
 *                       sender_id:
 *                         type: number
 *                       receiver_id:
 *                         type: number
 *                       read_by:
 *                         type: array
 *                         items:
 *                           type: number
 *                       timestamp:
 *                         type: string
 *                         format: date-time
 *       400:
 *         description: Invalid receiver_id
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get("/message/get-private", requireAuth(), async (req: AuthenticatedRequest, res: Response) => {
	const senderId = Number(req.auth?.userId)
	const receiverId = Number(req.query.receiver_id)

	// Validate input
	if (!Number.isInteger(receiverId) || receiverId <= 0) {
		res.status(400).json({
			success: false,
			message: "Invalid receiver_id",
			status_code: 400
		})
		return
	}

	try {
		const collection = await getChatMessageCollection()

		// Query messages where:
		// (sender_id = senderId AND receiver_id = receiverId) OR (sender_id = receiverId AND receiver_id = senderId)
		const messages = await collection
			.find({
				$or: [
					{ sender_id: senderId, receiver_id: receiverId },
					{ sender_id: receiverId, receiver_id: senderId }
				]
			})
			.sort({ timestamp: 1 })
			.toArray()

		const conversationKey = getConversationKey(senderId, receiverId)
		// Format response
		const formattedMessages = await Promise.all(
			messages.map(async (msg: Document) => {
				const user = await prisma.user.findUnique({
					where: { id: BigInt(msg.sender_id) },
					select: { id: true, display_name: true, avatar_seq: true }
				})
				return {
					_id: msg._id.toString(),
					message: msg.message,
					conversation_key: conversationKey,
					sender: user ? {
						id: Number(user.id),
						display_name: user.display_name,
						avatar_url: getAvatarUrl(user.id, user.avatar_seq)
					} : null,
					receiver_id: msg.receiver_id,
					seen: msg.seen,
					timestamp: new Date(msg.timestamp).toISOString()
				}
			})
		)

		res.status(200).json({
			success: true,
			message: "Success",
			status_code: 200,
			data: formattedMessages
		})
	} catch (error) {
		console.error("Get private messages error:", error)
		res.status(500).json({
			success: false,
			message: "Internal server error",
			status_code: 500
		})
	}
})

export default router
