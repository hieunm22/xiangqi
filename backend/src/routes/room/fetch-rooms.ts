import { Response, Router } from "express"
import prisma from "prisma"
import { getAvatarUrl } from "common/helper"
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
 *                   example: fetch-rooms.messages.success
 *                 status_code:
 *                   type: integer
 *                   example: 200
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       name:
 *                         type: string
 *                       status:
 *                         type: integer
 *                       red_first:
 *                         type: boolean
 *                       bet_amount:
 *                         type: integer
 *                       created_at:
 *                         type: string
 *                         format: date-time
 *                       updated_at:
 *                         type: string
 *                         format: date-time
 *                       users:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             id:
 *                               type: integer
 *                             display_name:
 *                               type: string
 *                             avatar_seq:
 *                               type: integer
 *                             avatar_url:
 *                               type: string
 *                             team:
 *                               type: string
 *                               nullable: true
 *       400:
 *         description: Invalid status query parameter
 *       401:
 *         description: Unauthorized (missing, invalid, or expired token)
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
			where: {
				is_active: true,
				...(status !== undefined && { status })
			},
			orderBy: { created_at: "asc" },
			select: {
				id: true,
				name: true,
				status: true,
				red_first: true,
				bet_amount: true,
				host_id: true,
				created_at: true,
				updated_at: true,
				room_users: {
					orderBy: {
						joined_at: "asc"
					},
					select: {
						team: true,
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
				host_id: room.host_id === null ? null : Number(room.host_id),
				users: room_users.map(ru => ({
					...ru.users,
					id: Number(ru.users.id),
					avatar_seq: Number(ru.users.avatar_seq),
					avatar_url: getAvatarUrl(ru.users.id, ru.users.avatar_seq),
					team: ru.team
				}))
			}
		})

		res.status(200).json({
			success: true,
			message: "fetch-rooms.messages.success",
			status_code: 200,
			data: formattedRooms
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
