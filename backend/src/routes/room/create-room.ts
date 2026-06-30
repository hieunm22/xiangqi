import { Response, Router } from "express"
import prisma from "prisma"
import { BOT_USER_ID } from "common/bot-engine"
import { getAvatarUrl, getUTCNow } from "common/helper"
import { emitRoomCreated } from "common/socket"
import { requireAuth, AuthenticatedRequest } from "middleware/auth"
import { CreateRoomRequest } from "types/room.type"

const router = Router()

const ACCEPTABLE_BET_AMOUNTS = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000]

/**
 * @swagger
 * /api/room/create-room:
 *   post:
 *     summary: Create a new room
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
 *               - tableName
 *               - teamName
 *               - betAmount
 *             properties:
 *               tableName:
 *                 type: string
 *                 description: Name of the room
 *               teamName:
 *                 type: string
 *                 description: Team name for the current user
 *               redFirst:
 *                 type: boolean
 *                 description: Whether red moves first
 *                 default: true
 *               pveMode:
 *                 type: boolean
 *                 description: Whether the game is in PvE mode
 *                 default: false
 *               betAmount:
 *                 type: number
 *                 description: Bet amount for the room (valid values - 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000)
 *                 default: 10
 *                 enum: [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000]
 *     responses:
 *       201:
 *         description: Room created successfully
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
 *                   example: create-room.messages.room-created
 *                 status_code:
 *                   type: integer
 *                   example: 201
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
 *                             type: string
 *                           display_name:
 *                             type: string
 *                           avatar_seq:
 *                             type: integer
 *                           team:
 *                             type: string
 *                             nullable: true
 *                           avatar_url:
 *                             type: string
 *       400:
 *         description: Invalid request body
 *       401:
 *         description: Unauthorized (missing, invalid, or expired token)
 *       500:
 *         description: Internal server error
 */
router.post(
	"/room/create-room",
	requireAuth(),
	async (req: AuthenticatedRequest, res: Response) => {
		const { tableName, teamName, redFirst = true, pveMode = false, betAmount = 10 } = req.body as CreateRoomRequest
		const userId = req.auth?.userId

		// Validate room name
		if (!tableName || typeof tableName !== "string" || tableName.trim() === "") {
			res.status(400).json({
				success: false,
				message: "create-room.messages.name-required",
				status_code: 400
			})
			return
		}

		// Validate team name
		if (
			teamName !== null &&
			(typeof teamName !== "string" || (teamName !== "red" && teamName !== "black"))
		) {
			res.status(400).json({
				success: false,
				message: "create-room.messages.invalid-team-name",
				status_code: 400
			})
			return
		}

		// Validate redFirst
		if (typeof redFirst !== "boolean") {
			res.status(400).json({
				success: false,
				message: "create-room.messages.invalid-redFirst",
				status_code: 400
			})
			return
		}

		// Validate bet amount
		const isValidBetAmount = pveMode
			? betAmount === 0
			: ACCEPTABLE_BET_AMOUNTS.includes(betAmount) || betAmount === 0

		if (!isValidBetAmount) {
			res.status(400).json({
				success: false,
				message: "create-room.messages.invalid-bet-amount",
				status_code: 400
			})
			return
		}

		try {
			const userIdBigInt = BigInt(userId!)

			// Disallow betting more than 80% of the creator's balance
			if (betAmount > 0) {
				const user = await prisma.user.findUnique({
					where: { id: userIdBigInt },
					select: { total_amount: true }
				})
				// Integer-safe form of `betAmount > total_amount * 0.8`.
				if (!user || betAmount * 10 > user.total_amount * 8) {
					res.status(400).json({
						success: false,
						message: "create-room.messages.insufficient-amount",
						status_code: 400
					})
					return
				}
			}

			// Remove existing room_users records for this user
			await prisma.roomUser.deleteMany({
				where: {
					user_id: userIdBigInt
				}
			})

			// Seed only the requester for PvP rooms. Add a bot seat too in PvE mode,
			// on the team opposite to the requester.
			const roomUserSeed: { user_id: bigint; team: string | null; joined_at: Date }[] = [
				{ user_id: userIdBigInt, team: teamName, joined_at: getUTCNow() }
			]
			if (pveMode) {
				// Determine bot team (opposite of user's team)
				let botTeam: "red" | "black" = "red"
				if (teamName === "red") {
					botTeam = "black"
				}
				roomUserSeed.push({ user_id: BOT_USER_ID, team: botTeam, joined_at: getUTCNow() })
			}

			const room = await prisma.room.create({
				data: {
					name: tableName,
					status: 1, // 1 = waiting for opponent
					red_first: redFirst,
					pve_mode: pveMode,
					bet_amount: betAmount,
					host_id: userIdBigInt,
					room_users: {
						create: roomUserSeed
					}
				},
				select: {
					id: true,
					name: true,
					status: true,
					red_first: true,
					pve_mode: true,
					bet_amount: true,
					host_id: true,
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
									avatar_seq: true,
									is_bot: true
								}
							},
							team: true
						}
					}
				}
			})

			const { room_users, ...roomData } = room
			const normalizedRoom = {
				...roomData,
				id: Number(room.id),
				host_id: room.host_id === null ? null : Number(room.host_id)
			}

			// Format response
			const formattedRoom = {
				room: normalizedRoom,
				users: room_users.map((gu: any) => ({
					...gu.users,
					id: gu.users.id.toString(),
					team: gu.team,
					avatar_url: getAvatarUrl(gu.users.id, gu.users.avatar_seq)
				}))
			}

			const dashboardRoom = {
				id: Number(room.id),
				name: room.name,
				status: room.status,
				red_first: room.red_first,
				bet_amount: room.bet_amount,
				host_id: room.host_id === null ? null : Number(room.host_id),
				created_at: room.created_at,
				updated_at: room.updated_at,
				users: room_users.map(gu => ({
					id: Number(gu.users.id),
					display_name: gu.users.display_name,
					avatar_seq: Number(gu.users.avatar_seq),
					avatar_url: getAvatarUrl(gu.users.id, gu.users.avatar_seq)
				}))
			}
			emitRoomCreated(dashboardRoom)

			res.status(201).json({
				success: true,
				message: "create-room.messages.room-created",
				status_code: 201,
				data: formattedRoom
			})
		} catch (err) {
			console.error("Error creating room:", err)
			res.status(500).json({
				success: false,
				message: "create-room.messages.internal-server-error",
				status_code: 500
			})
		}
	}
)

export default router
