import { Response, Router } from "express"
import prisma from "prisma"
import { getChatMessageCollection } from "common/mongodb"
import { requireAuth, AuthenticatedRequest } from "middleware/auth"
import { getAvatarUrl } from "common/helper"
import { emitRoomMessage } from "common/socket"

const router = Router()

/**
 * @swagger
 * /api/message/send-room-message:
 *   post:
 *     summary: Send a room message
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
 *               - room_id
 *               - message
 *             properties:
 *               room_id:
 *                 type: number
 *               message:
 *                 type: string
 *     responses:
 *       201:
 *         description: Message sent successfully
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: User has not joined the room
 *       404:
 *         description: Room not found or inactive
 *       500:
 *         description: Internal server error
 */
router.post("/message/send-room-message", requireAuth(), async (req: AuthenticatedRequest, res: Response) => {
	const senderId = Number(req.auth?.userId)
	const { room_id, message } = req.body

	if (!Number.isInteger(room_id) || room_id <= 0) {
		res.status(400).json({
			success: false,
			message: "Invalid room_id",
			status_code: 400
		})
		return
	}

	if (!message || typeof message !== "string" || message.trim().length === 0) {
		res.status(400).json({
			success: false,
			message: "Invalid message",
			status_code: 400
		})
		return
	}

	try {
		const roomIdBigInt = BigInt(room_id)
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
					user_id: BigInt(senderId)
				}
			},
			select: { room_id: true }
		})

		if (!roomUser) {
			res.status(403).json({
				success: false,
				message: "Forbidden",
				status_code: 403
			})
			return
		}

		const timestamp = new Date()
		const payload = {
			room_id,
			sender_id: senderId,
			message: message.trim(),
			timestamp,
			read_by: [senderId]
		}

		const collection = await getChatMessageCollection()
		const result = await collection.insertOne(payload)

		// Fetch user info
		const user = await prisma.user.findUnique({
			where: { id: BigInt(senderId) },
			select: { id: true, display_name: true, avatar_seq: true }
		})

		const messageData = {
			_id: result.insertedId.toString(),
			room_id: payload.room_id,
			sender: user ? {
				id: Number(user.id),
				display_name: user.display_name,
				avatar_url: getAvatarUrl(user.id, user.avatar_seq)
			} : null,
			message: payload.message,
			timestamp: timestamp.toISOString()
		}

		// Notify the other players/spectators in the room in real time
		emitRoomMessage(room_id, messageData, senderId)

		res.status(201).json({
			success: true,
			message: "Success",
			status_code: 201,
			data: messageData
		})
	} catch (error) {
		console.error("Send room message error:", error)
		res.status(500).json({
			success: false,
			message: "Internal server error",
			status_code: 500
		})
	}
})

export default router
