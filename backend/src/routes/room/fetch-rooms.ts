import { Response, Router } from "express"
import prisma from "prisma"
import { requireAuth, AuthenticatedRequest } from "middleware/auth"

const router = Router()

/**
 * @swagger
 * /api/room/fetch-rooms:
 *   get:
 *     summary: Fetch all rooms
 *     tags:
 *       - Room
 *     security:
 *       - basicAuth: []
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         required: false
 *         schema:
 *           type: integer
 *         description: Filter by room status
 *     responses:
 *       200:
 *         description: Rooms fetched successfully
 *       400:
 *         description: Invalid status query parameter
 *       500:
 *         description: Internal server error
 */
router.get("/room/fetch-rooms", requireAuth(), async (req: AuthenticatedRequest, res: Response) => {
	const statusQuery = req.query.status

	if (
		statusQuery !== undefined &&
		(Number.isNaN(Number(statusQuery)) || !Number.isInteger(Number(statusQuery)))
	) {
		res.status(400).json({
			success: false,
			message: "fetch-rooms.messages.invalid-status",
			status_code: 400,
			rooms: []
		})
		return
	}

	const status = statusQuery !== undefined ? Number(statusQuery) : undefined

	try {
		const rooms = await prisma.room.findMany({
			...(status !== undefined && { where: { status } }),
			orderBy: { created_at: "desc" },
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
						}
					}
				}
			}
		})

		const formattedRooms = rooms.map(room => {
			const { room_users, ...rest } = room
			return {
				...rest,
				id: Number(room.id),
				users: room_users.map(gu => ({
					...gu.users,
					id: Number(gu.users.id),
					avatar_seq: Number(gu.users.avatar_seq),
					avatar_url:
						Number(gu.users.avatar_seq) === 0
							? `/images/${Number(gu.users.id)}.jpg`
							: `/images/${Number(gu.users.id)}_${Number(gu.users.avatar_seq)}.jpg`
				}))
			}
		})

		res.status(200).json({
			success: true,
			message: "fetch-rooms.messages.success",
			status_code: 200,
			rooms: formattedRooms
		})
	} catch (err) {
		console.error("Fetch rooms error:", err)
		res.status(500).json({
			success: false,
			message: "fetch-rooms.messages.internal-server-error",
			status_code: 500,
			rooms: []
		})
	}
})

export default router
