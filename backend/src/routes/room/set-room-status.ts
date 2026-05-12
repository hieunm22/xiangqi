import { Response, Router } from "express"
import prisma from "../../prisma"
import { requireAuth, AuthenticatedRequest } from "../../middleware/auth"

const router = Router()

interface SetRoomStatusRequest {
	id: number
	status: number
}

const VALID_STATUSES = [1, 2]

/**
 * @swagger
 * /api/room/status:
 *   patch:
 *     summary: Update room status
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
 *               - status
 *             properties:
 *               id:
 *                 type: integer
 *                 format: int64
 *               status:
 *                 type: integer
 *                 enum: [1, 2]
 */
const handleSetRoomStatus = async (req: AuthenticatedRequest, res: Response) => {
	const { id, status } = req.body as SetRoomStatusRequest

	if (!Number.isInteger(id) || id <= 0) {
		res.status(400).json({
			success: false,
			message: "Field 'id' is required and must be a positive integer",
			status_code: 400
		})
		return
	}

	if (!Number.isInteger(status) || !VALID_STATUSES.includes(status)) {
		res.status(400).json({
			success: false,
			message: "Field 'status' must be either 1 or 2",
			status_code: 400
		})
		return
	}

	try {
		const room = await prisma.room.update({
			where: { id: BigInt(id) },
			data: {
				status
			},
			select: {
				id: true,
				name: true,
				status: true,
				red_first: true,
				bet_amount: true,
				created_at: true,
				updated_at: true
			}
		})

		res.status(200).json({
			success: true,
			message: "Set room status successfully",
			status_code: 200,
			room: {
				...room,
				id: Number(room.id)
			}
		})
	} catch (err: any) {
		if (err?.code === "P2025") {
			res.status(404).json({
				success: false,
				message: "Room not found",
				status_code: 404
			})
			return
		}

		console.error("Set room status error:", err)
		res.status(500).json({
			success: false,
			message: "Internal server error",
			status_code: 500
		})
	}
}

router.patch("/room/status", requireAuth(), handleSetRoomStatus)
router.put("/room/status", requireAuth(), handleSetRoomStatus)

export default router
