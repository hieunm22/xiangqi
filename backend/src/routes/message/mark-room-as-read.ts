import { Response, Router } from "express"
import prisma from "prisma"
import { getChatMessageCollection } from "common/mongodb"
import { requireAuth, AuthenticatedRequest } from "middleware/auth"

const router = Router()

/**
 * @swagger
 * /api/message/mark-room-as-read:
 *   post:
 *     summary: Mark all messages in a room as read by current user
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
 *             properties:
 *               room_id:
 *                 type: number
 *     responses:
 *       200:
 *         description: Messages marked as read successfully
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
router.post("/message/mark-room-as-read", requireAuth(), async (req: AuthenticatedRequest, res: Response) => {
	const userId = Number(req.auth?.userId)
	const { room_id } = req.body

	if (!Number.isInteger(room_id) || room_id <= 0) {
		res.status(400).json({
			success: false,
			message: "Invalid room_id",
			status_code: 400
		})
		return
	}

	try {
		const roomIdBigInt = BigInt(room_id)

		// Verify room exists and is active
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

		// Verify user has joined the room
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

		// Update all messages in room: add userId to read_by if not exist
		const collection = await getChatMessageCollection()
		await collection.updateMany(
			{
				room_id,
				timestamp: { $gt: roomUser.joined_at }
			},
			{
				$addToSet: { read_by: userId }
			}
		)

		res.status(200).json({
			success: true,
			message: "All messages marked as read",
			status_code: 200
		})
	} catch (error) {
		console.error("Mark room message as read error:", error)
		res.status(500).json({
			success: false,
			message: "Internal server error",
			status_code: 500
		})
	}
})

export default router
