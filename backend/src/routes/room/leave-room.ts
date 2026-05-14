import { Response, Router } from "express"
import prisma from "../../prisma"
import { requireAuth, AuthenticatedRequest } from "../../middleware/auth"
import { LeaveRoomRequest } from "../../types/room.type"

const router = Router()

/**
 * @swagger
 * /api/room/leave:
 *   delete:
 *     summary: Leave a room
 *     tags:
 *       - Room
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
 *               - id
 *             properties:
 *               id:
 *                 type: integer
 *                 format: int64
 */
router.delete("/room/leave", requireAuth(), async (req: AuthenticatedRequest, res: Response) => {
	const { id } = req.body as LeaveRoomRequest
	const userId = req.auth?.userId

	if (!userId) {
		res.status(401).json({
			success: false,
			message: "Unauthorized",
			status_code: 401
		})
		return
	}

	if (!Number.isInteger(id) || id <= 0) {
		res.status(400).json({
			success: false,
			message: "leave-room.messages.invalid-room-id",
			status_code: 400
		})
		return
	}

	try {
		const roomId = BigInt(id)
		const deletedRoomUser = await prisma.roomUser.deleteMany({
			where: {
				room_id: roomId,
				user_id: BigInt(userId)
			}
		})

		if (deletedRoomUser.count === 0) {
			res.status(404).json({
				success: false,
				message: "leave-room.messages.player-not-in-room",
				status_code: 404
			})
			return
		}

		const countRemainingPlayers = await prisma.roomUser.count({
			where: {
				room_id: roomId
			}
		})

		if (countRemainingPlayers === 0) {
			await prisma.room.delete({
				where: {
					id: roomId
				}
			})
		}

		res.status(200).json({
			success: true,
			message: "leave-room.messages.success",
			status_code: 200
		})
	} catch (err) {
		console.error("Leave room error:", err)
		res.status(500).json({
			success: false,
			message: "leave-room.messages.internal-server-error",
			status_code: 500
		})
	}
})

export default router
