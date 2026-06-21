import { Response, Router } from "express"
import { Document } from "mongodb"
import prisma from "prisma"
import { getAvatarUrl } from "common/helper"
import { getChatMessageCollection } from "common/mongodb"
import { requireAuth, AuthenticatedRequest } from "middleware/auth"

const router = Router()

/**
 * @swagger
 * /api/message/get-announcement:
 *   get:
 *     summary: Get announcements
 *     tags:
 *       - Message
 *     security:
 *       - basicAuth: []
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Announcements retrieved successfully
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
 *                         description: Announcement ID (MongoDB ObjectId)
 *                       message:
 *                         type: string
 *                       sender:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: number
 *                           display_name:
 *                             type: string
 *                           avatar_url:
 *                             type: string
 *                       seen:
 *                         type: boolean
 *                         description: Whether the current user has read this announcement
 *                       timestamp:
 *                         type: string
 *                         format: date-time
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get("/message/get-announcement", requireAuth(), async (req: AuthenticatedRequest, res: Response) => {
	const userId = Number(req.auth?.userId)

	try {
		const collection = await getChatMessageCollection()
		const announcements = await collection.find({ type: "announcement" }).sort({ timestamp: 1 }).toArray()

		// High-water mark: the latest time this user accessed the announcements
		const lastRead = await prisma.userAnnouncementRead.findFirst({
			where: { user_id: BigInt(userId) },
			orderBy: { read_announcement_at: "desc" },
			select: { read_announcement_at: true }
		})
		const lastReadAt = lastRead?.read_announcement_at ?? null

		const formattedAnnouncements = await Promise.all(
			announcements.map(async (item: Document) => {
				const user = await prisma.user.findUnique({
					where: { id: BigInt(item.sender_id) },
					select: { id: true, display_name: true, avatar_seq: true }
				})

				return {
					_id: item._id.toString(),
					sender: user ? {
						id: Number(user.id),
						display_name: user.display_name,
						avatar_url: getAvatarUrl(user.id, user.avatar_seq)
					} : null,
					message: item.message,
					seen: lastReadAt !== null && new Date(item.timestamp) <= lastReadAt,
					timestamp: new Date(item.timestamp).toISOString()
				}
			})
		)

		res.status(200).json({
			success: true,
			message: "Success",
			status_code: 200,
			data: formattedAnnouncements
		})
	} catch (error) {
		console.error("Get announcements error:", error)
		res.status(500).json({
			success: false,
			message: "Internal server error",
			status_code: 500
		})
	}
})

export default router
