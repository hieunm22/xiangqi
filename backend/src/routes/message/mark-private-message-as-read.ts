import { Response, Router } from "express"
import prisma from "prisma"
import { getConversationKey } from "common/helper"
import { getChatMessageCollection } from "common/mongodb"
import { requireAuth, AuthenticatedRequest } from "middleware/auth"

const router = Router()

/**
 * @swagger
 * /api/message/mark-private-message-as-read:
 *   post:
 *     summary: Mark all private messages in a conversation as read by current user
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
 *               - receiver_id
 *             properties:
 *               receiver_id:
 *                 type: number
 *                 description: The ID of the other user in the conversation
 *     responses:
 *       200:
 *         description: Messages marked as read successfully
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.post("/message/mark-private-message-as-read", requireAuth(), async (req: AuthenticatedRequest, res: Response) => {
	const userId = Number(req.auth?.userId)
	const { receiver_id } = req.body

	if (!Number.isInteger(receiver_id) || receiver_id <= 0) {
		res.status(400).json({
			success: false,
			message: "Invalid receiver_id",
			status_code: 400
		})
		return
	}

	if (userId === receiver_id) {
		res.status(400).json({
			success: false,
			message: "Invalid receiver_id",
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

		// Mark all unread messages from receiver_id to userId (seen: false or missing) as seen.
		const collection = await getChatMessageCollection()
		await collection.updateMany(
			{
				sender_id: receiver_id,
				receiver_id: userId,
				seen: { $ne: true }
			},
			{
				$set: { seen: true }
			}
		)

		res.status(200).json({
			success: true,
			message: "All messages marked as read",
			status_code: 200
		})
	} catch (error) {
		console.error("Mark private message as read error:", error)
		res.status(500).json({
			success: false,
			message: "Internal server error",
			status_code: 500
		})
	}
})

export default router
