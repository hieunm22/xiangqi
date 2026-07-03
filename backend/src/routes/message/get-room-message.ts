import { Response, Router } from "express"
import { Document } from "mongodb"
import prisma from "prisma"
import { getAvatarUrl } from "common/helper"
import { getChatMessageCollection } from "common/mongodb"
import { requireAuth, AuthenticatedRequest } from "middleware/auth"

const router = Router()

/**
 * @swagger
 * /api/message/get-room-message:
 *   get:
 *     summary: Get room messages
 *     tags:
 *       - Message
 *     security:
 *       - basicAuth: []
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: roomId
 *         required: true
 *         schema:
 *           type: number
 *         description: Room ID
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
 *                       room_id:
 *                         type: number
 *                       read_by:
 *                         type: array
 *                         items:
 *                           type: number
 *                       timestamp:
 *                         type: string
 *                         format: date-time
 *       400:
 *         description: Invalid roomId
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: User has not joined the room
 *       404:
 *         description: Room not found or inactive
 *       500:
 *         description: Internal server error
 */
router.get("/message/get-room-message", requireAuth(), async (req: AuthenticatedRequest, res: Response) => {
	const userId = Number(req.auth?.userId)
	const roomId = Number(req.query.roomId)

	if (!Number.isInteger(roomId) || roomId <= 0) {
		res.status(400).json({
			success: false,
			message: "Invalid roomId",
			status_code: 400
		})
		return
	}

	try {
		const roomIdBigInt = BigInt(roomId)
		const room = await prisma.room.findUnique({
			where: { id: roomIdBigInt, is_active: true },
			select: { id: true }
		})

		if (!room) {
			res.status(404).json({
				success: false,
				message: "Room not found",
				status_code: 404
			})
			return
		}

		const roomUser = await prisma.roomUser.findUnique({
			where: {
				room_id_user_id: {
					room_id: roomIdBigInt,
					user_id: BigInt(userId)
				}
			},
			select: { room_id: true, joined_at: true }
		})

		if (!roomUser) {
			res.status(403).json({
				success: false,
				message: "Forbidden",
				status_code: 403
			})
			return
		}

		const collection = await getChatMessageCollection()
		const messages = await collection.find({ room_id: roomId }).sort({ timestamp: 1 }).toArray()

		const formattedMessages = await Promise.all(
			messages.map(async (msg: Document) => {
				const messageTimestamp = new Date(msg.timestamp)
				const isAfterJoin = messageTimestamp > roomUser.joined_at
				const hasRead = (msg.read_by || []).includes(userId)
				const user = await prisma.user.findUnique({
					where: { id: BigInt(msg.sender_id) },
					select: { id: true, display_name: true, avatar_seq: true }
				})

				return {
					_id: msg._id.toString(),
					room_id: msg.room_id,
					sender: user ? {
						id: Number(user.id),
						display_name: user.display_name,
						avatar_url: getAvatarUrl(user.id, user.avatar_seq)
					} : null,
					message: msg.message,
					read_by: msg.read_by || [],
					// Messages sent before the user joined are treated as already seen.
					seen: !isAfterJoin || hasRead,
					timestamp: messageTimestamp.toISOString()
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
		console.error("Get room messages error:", error)
		res.status(500).json({
			success: false,
			message: "Internal server error",
			status_code: 500
		})
	}
})

export default router
