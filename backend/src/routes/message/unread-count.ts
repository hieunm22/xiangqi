import { Response, Router } from "express"
import prisma from "prisma"
import { getChatMessageCollection } from "common/mongodb"
import { requireAuth, AuthenticatedRequest } from "middleware/auth"

const router = Router()

/**
 * @swagger
 * /api/message/unread-count:
 *   get:
 *     summary: Get unread message count grouped by conversation for current user
 *     tags:
 *       - Message
 *     security:
 *       - basicAuth: []
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Unread message count retrieved successfully
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
 *                   type: object
 *                   properties:
 *                     total_pm:
 *                       type: number
 *                       description: Total count of unread private messages
 *                     conversations:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           conversation_key:
 *                             type: string
 *                             description: Conversation key in format min_id_max_id
 *                           count:
 *                             type: number
 *                             description: Number of unread messages in this conversation
 *                     announcements:
 *                       type: number
 *                       description: Number of announcements created after the user's last read mark
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get("/message/unread-count", requireAuth(), async (req: AuthenticatedRequest, res: Response) => {
	const currentUserId = Number(req.auth?.userId)

	try {
		const collection = await getChatMessageCollection()

		// Count total unread messages for current user
		const totalCount = await collection.countDocuments({
			receiver_id: currentUserId,
			seen: false
		})

		// Get unread count grouped by conversation_key
		const conversations = await collection
			.aggregate([
				{
					$match: {
						receiver_id: currentUserId,
						seen: false
					}
				},
				{
					$group: {
						_id: "$conversation_key",
						count: { $sum: 1 }
					}
				},
				{
					$sort: { _id: 1 }
				}
			])
			.toArray()

		const conversationList = conversations.map(item => ({
			conversation_key: item._id,
			count: item.count
		}))

		// Count announcements created after the user's latest read mark
		// (high-water mark). No read mark yet => treated as caught up (0).
		const lastRead = await prisma.userAnnouncementRead.findFirst({
			where: { user_id: BigInt(currentUserId) },
			orderBy: { read_announcement_at: "desc" },
			select: { read_announcement_at: true }
		})
		const lastReadAt = lastRead?.read_announcement_at ?? null
		const announcements = lastReadAt === null
			? 0
			: await collection.countDocuments({
				type: "announcement",
				timestamp: { $gt: lastReadAt }
			})

		res.status(200).json({
			success: true,
			message: "Success",
			status_code: 200,
			data: {
				total_pm: totalCount,
				conversations: conversationList,
				announcements
			}
		})
	} catch (error) {
		console.error("Get unread message count error:", error)
		res.status(500).json({
			success: false,
			message: "Internal server error",
			status_code: 500
		})
	}
})

export default router
