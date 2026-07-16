import { Response, Router } from "express"
import prisma from "prisma"
import { computeClock } from "common/game/game-clock"
import { decorateRoomUsersWithBackReady } from "common/game/post-game.helper"
import { getAvatarUrl } from "common/helper"
import { getChatMessageCollection } from "common/mongodb"
import { requireAuth, AuthenticatedRequest } from "middleware/auth"

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
 *                         time_limit:
 *                           type: integer
 *                           nullable: true
 *                         time_increment:
 *                           type: integer
 *                         time_per_move:
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
 *                           total_amount:
 *                             type: integer
 *                           is_bot:
 *                             type: boolean
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
 *                     clock:
 *                       type: object
 *                       nullable: true
 *                       description: Live countdown snapshot for an in-progress clocked game; null otherwise.
 *                       properties:
 *                         redMs:
 *                           type: integer
 *                         blackMs:
 *                           type: integer
 *                         activeTeam:
 *                           type: string
 *                           enum: [red, black]
 *                         perMoveRemainingMs:
 *                           type: integer
 *                           description: Active team's remaining time for the current move; 0 when per-move is off.
 *                         serverNow:
 *                           type: integer
 *                         timeLimit:
 *                           type: integer
 *                         timeIncrement:
 *                           type: integer
 *                         timePerMove:
 *                           type: integer
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
	const userId = Number(req.auth?.userId)
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
			where: {
				id: roomIdBigInt,
				is_active: true,
			},
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
				host_id: true,
				game_type: true,
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
								user_name: true,
								display_name: true,
								avatar_seq: true,
								email: true,
								gender: true,
								total_amount: true,
								is_bot: true
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

		// Get user's join time to filter out messages sent before they joined
		const roomUser = await prisma.roomUser.findUnique({
			where: {
				room_id_user_id: {
					room_id: roomIdBigInt,
					user_id: BigInt(userId)
				}
			},
			select: { joined_at: true }
		})

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

		// Count messages in this room sent after the user joined that they have not read yet
		const chatCollection = await getChatMessageCollection()
		const unreadCount = await chatCollection.countDocuments({
			room_id: roomId,
			read_by: { $nin: [userId] },
			timestamp: { $gt: roomUser?.joined_at ?? new Date(0) },
		})

		const { room_users } = room
		const formattedUsers = room_users.map(ru => ({
			id: Number(ru.users.id),
			user_name: ru.users.user_name,
			display_name: ru.users.display_name,
			email: ru.users.email,
			gender: ru.users.gender,
			team: ru.team,
			total_amount: ru.users.total_amount,
			is_bot: ru.users.is_bot,
			joined_at: ru.joined_at,
			avatar_url: getAvatarUrl(ru.users.id, ru.users.avatar_seq)
		}))
		const usersWithBackReady = decorateRoomUsersWithBackReady(roomId, formattedUsers)

		// Current countdown state for an in-progress game
		const clock = game ? await computeClock(game.id) : null

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
					time_limit: room.time_limit,
					time_increment: room.time_increment,
					time_per_move: room.time_per_move,
					host_id: room.host_id === null ? null : Number(room.host_id),
					game_type: room.game_type,
					created_at: room.created_at,
					updated_at: room.updated_at
				},
				chat: {
					unread_count: unreadCount
				},
				users: usersWithBackReady,
				game,
				clock,
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
