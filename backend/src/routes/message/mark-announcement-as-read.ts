import { Response, Router } from "express"
import prisma from "prisma"
import { requireAuth, AuthenticatedRequest } from "middleware/auth"

const router = Router()

/**
 * @swagger
 * /api/message/mark-announcement-as-read:
 *   post:
 *     summary: Mark announcements as read by current user
 *     description: >
 *       Records an access to the announcement feed. Each call appends a new row
 *       to user_announcement_read so access history can be audited later.
 *     tags:
 *       - Message
 *     security:
 *       - basicAuth: []
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Announcements marked as read successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.post("/message/mark-announcement-as-read", requireAuth(), async (req: AuthenticatedRequest, res: Response) => {
	const userId = Number(req.auth?.userId)
	const sessionId = String(req.auth?.sessionId)

	try {
		// One record per login session: refresh the read time if this
		// (user, session) already accessed announcements, otherwise insert.
		const record = await prisma.userAnnouncementRead.upsert({
			where: {
				user_id_session_id: {
					user_id: BigInt(userId),
					session_id: sessionId
				}
			},
			create: { user_id: BigInt(userId), session_id: sessionId },
			update: { read_announcement_at: new Date() },
			select: { read_announcement_at: true }
		})

		res.status(200).json({
			success: true,
			message: "Announcements marked as read",
			status_code: 200,
			data: {
				read_announcement_at: record.read_announcement_at.toISOString()
			}
		})
	} catch (error) {
		console.error("Mark announcement as read error:", error)
		res.status(500).json({
			success: false,
			message: "Internal server error",
			status_code: 500
		})
	}
})

export default router
