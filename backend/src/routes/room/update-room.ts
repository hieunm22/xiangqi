import { Response, Router } from "express"
import prisma from "prisma"
import { ACCEPTABLE_TIME_LIMITS } from "common/constant"
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
 *                   example: update-room.messages.success
 *                 status_code:
 *                   type: integer
 *                   example: 200
 *                 data:
 *                   type: object
 *                   properties:
 *                     room:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: integer
 *                         name:
 *                           type: string
 *                         status:
 *                           type: integer
 *                         red_first:
 *                           type: boolean
 *                         pve_mode:
 *                           type: boolean
 *                         bet_amount:
 *                           type: integer
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
	const { id, name, timeLimit } = req.body as {
		id: number
		name: string
		timeLimit: number | null
	}
	const userId = req.auth?.userId
	const hasTimeLimit = Object.prototype.hasOwnProperty.call(req.body ?? {}, "timeLimit")

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

	if (
		hasTimeLimit &&
		timeLimit !== null &&
		!ACCEPTABLE_TIME_LIMITS.includes(timeLimit as number)
	) {
		res.status(400).json({
			success: false,
			message: "update-room.messages.invalid-time-limit",
			status_code: 400
		})
		return
	}

	try {
		const roomId = BigInt(id)
		const userIdBigInt = BigInt(userId)

		const room = await prisma.room.findUnique({
			where: { id: roomId },
			select: { id: true, host_id: true }
		})

		if (!room) {
			res.status(404).json({
				success: false,
				message: "update-room.messages.room-not-found",
				status_code: 404
			})
			return
		}

		// Only the host can update the room
		if (room.host_id !== userIdBigInt) {
			res.status(403).json({
				success: false,
				message: "update-room.messages.forbidden",
				status_code: 403
			})
			return
		}

		const updatedRoom = await prisma.room.update({
			where: { id: roomId },
			data: {
				name: name.trim(),
				...(hasTimeLimit ? { time_limit: timeLimit ?? null } : {})
			},
			select: {
				id: true,
				name: true,
				status: true,
				red_first: true,
				pve_mode: true,
				bet_amount: true,
				time_limit: true,
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
