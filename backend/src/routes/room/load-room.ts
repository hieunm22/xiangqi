import { Response, Router } from "express"
import prisma from "../../prisma"
import { requireAuth, AuthenticatedRequest } from "../../middleware/auth"

const router = Router()

/**
 * @swagger
 * /api/room/info/{id}:
 *   get:
 *     summary: Get room info by room ID
 *     tags:
 *       - Room
 *     security:
 *       - basicAuth: []
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           format: int64
 *     responses:
 *       200:
 *         description: Room loaded successfully
 *       400:
 *         description: Invalid room id
 *       404:
 *         description: Room not found
 *       500:
 *         description: Internal server error
 */
router.get("/room/info/:id", requireAuth(), async (req: AuthenticatedRequest, res: Response) => {
	const roomId = Number(req.params.id)

	if (!Number.isInteger(roomId) || roomId <= 0) {
		res.status(400).json({
			success: false,
			message: "Room ID must be a positive integer",
			status_code: 400,
			room: null
		})
		return
	}

	try {
		const room = await prisma.room.findUnique({
			where: { id: BigInt(roomId) },
			select: {
				id: true,
				name: true,
				status: true,
				red_first: true,
				bet_amount: true,
				created_at: true,
				updated_at: true,
				room_users: {
					orderBy: {
						joined_at: "asc"
					},
					select: {
						users: {
							select: {
								id: true,
								display_name: true,
								avatar_seq: true
							}
						},
						team: true
					}
				}
			}
		})

		if (!room) {
			res.status(404).json({
				success: false,
				message: "Room not found",
				status_code: 404,
				room: null
			})
			return
		}

		const { room_users, ...rest } = room
		const formattedRoom = {
			...rest,
			id: Number(room.id),
			users: room_users.map(ru => ({
				...ru.users,
				id: Number(ru.users.id),
				team: ru.team,
				avatar_seq: Number(ru.users.avatar_seq),
				avatar_url:
					Number(ru.users.avatar_seq) === 0
						? `/images/${Number(ru.users.id)}.jpg`
						: `/images/${Number(ru.users.id)}_${Number(ru.users.avatar_seq)}.jpg`
			}))
		}

		res.status(200).json({
			success: true,
			message: "Load room successfully",
			status_code: 200,
			room: formattedRoom
		})
	} catch (err) {
		console.error("Load room info error:", err)
		res.status(500).json({
			success: false,
			message: "Internal server error",
			status_code: 500,
			room: null
		})
	}
})

export default router
