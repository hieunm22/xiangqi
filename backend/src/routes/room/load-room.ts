import { Response, Router } from "express"
import prisma from "prisma"
import { getAvatarUrl } from "common/helper"
import { requireAuth, AuthenticatedRequest } from "middleware/auth"
import { totalmem } from "node:os"

const router = Router()

/**
 * @swagger
 * /api/room/info:
 *   get:
 *     summary: Get room info by room ID
 *     tags:
 *       - Room
 *     security:
 *       - basicAuth: []
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           format: int64
 *     responses:
 *       200:
 *         description: Room loaded successfully
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
 *                   example: load-room.messages.success
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
 *                         created_at:
 *                           type: string
 *                           format: date-time
 *                         updated_at:
 *                           type: string
 *                           format: date-time
 *                     users:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                           display_name:
 *                             type: string
 *                           team:
 *                             type: string
 *                             nullable: true
 *                           total_points:
 *                             type: integer
 *                           joined_at:
 *                             type: string
 *                             format: date-time
 *                           avatar_url:
 *                             type: string
 *                     game:
 *                       type: object
 *                       nullable: true
 *                       properties:
 *                         id:
 *                           type: string
 *                         room_id:
 *                           type: integer
 *                         winner_id:
 *                           type: integer
 *                           nullable: true
 *                         status:
 *                           type: integer
 *                         bot_difficulty:
 *                           type: integer
 *                           nullable: true
 *       400:
 *         description: Invalid room id
 *       401:
 *         description: Unauthorized (missing, invalid, or expired token)
 *       404:
 *         description: Room not found
 *       500:
 *         description: Internal server error
 */
router.get("/room/info", requireAuth(), async (req: AuthenticatedRequest, res: Response) => {
	const roomId = Number(req.query.id)

	if (!Number.isInteger(roomId) || roomId <= 0) {
		res.status(400).json({
			success: false,
			message: "load-room.messages.invalid-room-id",
			status_code: 400
		})
		return
	}

	try {
		const roomIdBigInt = BigInt(roomId)
		const room = await prisma.room.findUnique({
			where: { id: roomIdBigInt, is_active: true },
			select: {
				id: true,
				name: true,
				status: true,
				red_first: true,
				pve_mode: true,
				bet_amount: true,
				created_at: true,
				updated_at: true,
				games: {
					where: {
						status: 1
					},
					select: {
						id: true,
						room_id: true,
						winner_id: true,
						status: true,
						bot_difficulty: true
					},
					orderBy: {
						id: "desc"
					},
					take: 1
				},
				room_users: {
					orderBy: {
						joined_at: "asc"
					},
					select: {
						joined_at: true,
						users: {
							select: {
								id: true,
								display_name: true,
								avatar_seq: true,
								total_points: true
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
				message: "load-room.messages.room-not-found",
				status_code: 404,
				data: null
			})
			return
		}

		let game: {
			id: string
			room_id: number
			winner_id: number | null
			status: number
			bot_difficulty: number | null
		} | null = null
		const games =
			(room as {
				games?: Array<{
					id: string
					room_id: string | number | bigint
					winner_id: string | number | bigint | null
					status: number
					bot_difficulty: number | null
				}>
			}).games ?? []
		if (Number(room.status) === 2 && games.length > 0) {
			game = {
				id: games[0].id,
				room_id: Number(games[0].room_id),
				winner_id: games[0].winner_id === null ? null : Number(games[0].winner_id),
				status: games[0].status,
				bot_difficulty: games[0].bot_difficulty
			}
		}

		const { room_users } = room
		const formattedUsers = room_users.map(ru => ({
			id: Number(ru.users.id),
			display_name: ru.users.display_name,
			team: ru.team,
			total_points: ru.users.total_points,
			joined_at: ru.joined_at,
			avatar_url: getAvatarUrl(ru.users.id, ru.users.avatar_seq)
		}))

		res.status(200).json({
			success: true,
			message: "load-room.messages.success",
			status_code: 200,
			data: {
				room: {
					id: Number(room.id),
					name: room.name,
					status: room.status,
					red_first: room.red_first,
					pve_mode: room.pve_mode,
					bet_amount: room.bet_amount,
					created_at: room.created_at,
					updated_at: room.updated_at
				},
				users: formattedUsers,
				game
			}
		})
	} catch (err) {
		console.error("Load room info error:", err)
		res.status(500).json({
			success: false,
			message: "load-room.messages.internal-server-error",
			status_code: 500,
			data: null
		})
	}
})

export default router

