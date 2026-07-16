import { Response, Router } from "express"
import { leaveRoomEffect } from "common/game/leave-room.helper"
import { requireAuth, AuthenticatedRequest } from "middleware/auth"
import { LeaveRoomRequest } from "types/room.type"

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
 *     responses:
 *       200:
 *         description: Left room successfully
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
 *                   example: leave-room.messages.success
 *                 status_code:
 *                   type: integer
 *                   example: 200
 *       400:
 *         description: Invalid room id
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Room not found or player not in room
 *       500:
 *         description: Internal server error
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
		const result = await leaveRoomEffect(BigInt(id), BigInt(userId))

		if (result === "room-not-found") {
			res.status(404).json({
				success: false,
				message: "leave-room.messages.room-not-found",
				status_code: 404
			})
			return
		}

		if (result === "not-in-room") {
			res.status(404).json({
				success: false,
				message: "leave-room.messages.player-not-in-room",
				status_code: 404
			})
			return
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
