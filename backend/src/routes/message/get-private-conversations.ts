import { Response, Router } from "express"
import prisma from "prisma"
import { getAvatarUrl } from "common/helper"
import { getChatMessageCollection } from "common/mongodb"
import { requireAuth, AuthenticatedRequest } from "middleware/auth"

const router = Router()

/**
 * @swagger
 * /api/message/get-private-conversations:
 *   get:
 *     summary: Get private conversations for the current user, ordered by last message time (desc)
 *     tags:
 *       - Message
 *     security:
 *       - basicAuth: []
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Conversations retrieved successfully
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
 *                       conversation_key:
 *                         type: string
 *                         description: Conversation key in format min_id_max_id
 *                       partner:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: number
 *                           display_name:
 *                             type: string
 *                           avatar_url:
 *                             type: string
 *                       last_message:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                           message:
 *                             type: string
 *                           sender_id:
 *                             type: number
 *                           timestamp:
 *                             type: string
 *                             format: date-time
 *                       unread_count:
 *                         type: number
 *                         description: Number of unread messages sent to the current user
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get("/message/get-private-conversations", requireAuth(), async (req: AuthenticatedRequest, res: Response) => {
	const currentUserId = Number(req.auth?.userId)

	try {
		const collection = await getChatMessageCollection()

		// Group private messages (those carrying a conversation_key, which excludes
		// room messages) the current user is part of, keeping the latest message per
		// conversation, then order conversations by that latest message time desc.
		const conversations = await collection
			.aggregate([
				{
					$match: {
						conversation_key: { $exists: true },
						$or: [
							{ sender_id: currentUserId },
							{ receiver_id: currentUserId }
						]
					}
				},
				{ $sort: { timestamp: -1 } },
				{
					$group: {
						_id: "$conversation_key",
						last_message_id: { $first: "$_id" },
						last_message: { $first: "$message" },
						last_sender_id: { $first: "$sender_id" },
						last_receiver_id: { $first: "$receiver_id" },
						last_timestamp: { $first: "$timestamp" },
						unread_count: {
							$sum: {
								$cond: [
									{
										$and: [
											{ $eq: ["$receiver_id", currentUserId] },
											{ $eq: ["$seen", false] }
										]
									},
									1,
									0
								]
							}
						}
					}
				},
				{ $sort: { last_timestamp: -1 } }
			])
			.toArray()

		// Resolve the "other participant" for each conversation in a single query.
		const partnerIds = conversations.map(c =>
			c.last_sender_id === currentUserId ? c.last_receiver_id : c.last_sender_id
		)

		const partners = await prisma.user.findMany({
			where: { id: { in: partnerIds.map(id => BigInt(id)) } },
			select: { id: true, display_name: true, avatar_seq: true }
		})

		const partnerMap = new Map(partners.map(p => [Number(p.id), p]))

		const data = conversations.map(c => {
			const partnerId = c.last_sender_id === currentUserId ? c.last_receiver_id : c.last_sender_id
			const partner = partnerMap.get(partnerId)
			return {
				conversation_key: c._id,
				partner: partner
					? {
						id: Number(partner.id),
						display_name: partner.display_name,
						avatar_url: getAvatarUrl(partner.id, partner.avatar_seq)
					}
					: null,
				last_message: {
					_id: c.last_message_id.toString(),
					message: c.last_message,
					sender_id: c.last_sender_id,
					timestamp: new Date(c.last_timestamp).toISOString()
				},
				unread_count: c.unread_count
			}
		})

		res.status(200).json({
			success: true,
			message: "Success",
			status_code: 200,
			data
		})
	} catch (error) {
		console.error("Get private conversations error:", error)
		res.status(500).json({
			success: false,
			message: "Internal server error",
			status_code: 500
		})
	}
})

export default router
