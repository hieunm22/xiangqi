import { Response, Router } from "express"
import prisma from "prisma"
import {
	ACCEPTABLE_TIME_INCREMENTS,
	ACCEPTABLE_TIME_LIMITS,
	ACCEPTABLE_TIME_PER_MOVE
} from "common/constant"
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
 *               timeLimit:
 *                 type: integer
 *                 nullable: true
 *                 description: Total seconds per player. null clears the clock (and forces the two add-ons off). Only applied when provided.
 *                 enum: [300, 600, 900, 1200, 1800, 3600]
 *               timeIncrement:
 *                 type: integer
 *                 nullable: true
 *                 description: Seconds added after each completed move (Fischer). 0/null = off. Only applied when provided; forced to 0 if the same request clears timeLimit.
 *                 enum: [0, 3, 5, 15, 30, 60, 90]
 *               timePerMove:
 *                 type: integer
 *                 nullable: true
 *                 description: Hard cap in seconds for a single move. 0/null = off. Only applied when provided; forced to 0 if the same request clears timeLimit.
 *                 enum: [0, 30, 60, 90, 120, 180]
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
 *                         time_limit:
 *                           type: integer
 *                           nullable: true
 *                         time_increment:
 *                           type: integer
 *                         time_per_move:
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
	const { id, name, timeLimit, timeIncrement, timePerMove } = req.body as {
		id: number
		name: string
		timeLimit: number | null
		timeIncrement?: number | null
		timePerMove?: number | null
	}
	const userId = req.auth?.userId
	const body = req.body ?? {}
	const hasTimeLimit = Object.prototype.hasOwnProperty.call(body, "timeLimit")
	const hasTimeIncrement = Object.prototype.hasOwnProperty.call(body, "timeIncrement")
	const hasTimePerMove = Object.prototype.hasOwnProperty.call(body, "timePerMove")

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

	if (
		hasTimeIncrement &&
		timeIncrement !== null &&
		timeIncrement !== 0 &&
		!ACCEPTABLE_TIME_INCREMENTS.includes(timeIncrement as number)
	) {
		res.status(400).json({
			success: false,
			message: "update-room.messages.invalid-time-increment",
			status_code: 400
		})
		return
	}

	if (
		hasTimePerMove &&
		timePerMove !== null &&
		timePerMove !== 0 &&
		!ACCEPTABLE_TIME_PER_MOVE.includes(timePerMove as number)
	) {
		res.status(400).json({
			success: false,
			message: "update-room.messages.invalid-time-per-move",
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

		// Setting the total limit to unlimited in this request forces the two
		// add-ons off, since they only make sense with a total budget.
		const clearsAddOns = hasTimeLimit && (timeLimit ?? null) === null
		const updateData: {
			name: string
			time_limit?: number | null
			time_increment?: number
			time_per_move?: number
		} = { name: name.trim() }
		if (hasTimeLimit) {
			updateData.time_limit = timeLimit ?? null
		}
		if (clearsAddOns) {
			updateData.time_increment = 0
			updateData.time_per_move = 0
		} else {
			if (hasTimeIncrement) {
				updateData.time_increment = timeIncrement ?? 0
			}
			if (hasTimePerMove) {
				updateData.time_per_move = timePerMove ?? 0
			}
		}

		const updatedRoom = await prisma.room.update({
			where: { id: roomId },
			data: updateData,
			select: {
				id: true,
				name: true,
				status: true,
				red_first: true,
				pve_mode: true,
				bet_amount: true,
				time_limit: true,
				time_increment: true,
				time_per_move: true,
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
