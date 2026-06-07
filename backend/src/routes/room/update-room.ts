import { Response, Router } from "express"
import prisma from "prisma"
import { requireAuth, AuthenticatedRequest } from "middleware/auth"

const router = Router()

/**
 * @swagger
 * /api/room/update:
 *   patch:
 *     summary: Update room settings (host only)
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
 *               - name
 *             properties:
 *               id:
 *                 type: integer
 *                 format: int64
 *                 description: Room ID
 *               name:
 *                 type: string
 *                 description: New room name
 *     responses:
 *       200:
 *         description: Room updated successfully
 *       400:
 *         description: Invalid request body
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not the host)
 *       404:
 *         description: Room not found
 *       500:
 *         description: Internal server error
 */
router.patch("/room/update", requireAuth(), async (req: AuthenticatedRequest, res: Response) => {
	const { id, name } = req.body as { id: number; name: string }
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
			message: "update-room.messages.invalid-room-id",
			status_code: 400
		})
		return
	}

	if (!name || typeof name !== "string" || name.trim().length === 0) {
		res.status(400).json({
			success: false,
			message: "update-room.messages.name-required",
			status_code: 400
		})
		return
	}

	try {
		const roomId = BigInt(id)
		const userIdBigInt = BigInt(userId)

		const room = await prisma.room.findUnique({
			where: { id: roomId },
			select: { id: true }
		})

		if (!room) {
			res.status(404).json({
				success: false,
				message: "update-room.messages.room-not-found",
				status_code: 404
			})
			return
		}

		// Only the host (first user who joined) can update the room
		const firstUser = await prisma.roomUser.findFirst({
			where: { room_id: roomId },
			orderBy: { joined_at: "asc" },
			select: { user_id: true }
		})

		if (!firstUser || firstUser.user_id !== userIdBigInt) {
			res.status(403).json({
				success: false,
				message: "update-room.messages.forbidden",
				status_code: 403
			})
			return
		}

		const updatedRoom = await prisma.room.update({
			where: { id: roomId },
			data: { name: name.trim() },
			select: {
				id: true,
				name: true,
				status: true,
				red_first: true,
				pve_mode: true,
				bet_amount: true
			}
		})

		res.status(200).json({
			success: true,
			message: "update-room.messages.success",
			status_code: 200,
			data: {
				room: {
					...updatedRoom,
					id: Number(updatedRoom.id)
				}
			}
		})
	} catch (error) {
		console.error("[update-room] Error:", error)
		res.status(500).json({
			success: false,
			message: "update-room.messages.internal-server-error",
			status_code: 500
		})
	}
})

export default router
