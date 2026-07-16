import { Response, Router } from "express"
import prisma from "prisma"
import { BOT_USER_ID } from "common/bot-engine"
import { leaveRoomEffect } from "common/game/leave-room.helper"
import {
	ACCEPTABLE_TIME_INCREMENTS,
	ACCEPTABLE_TIME_LIMITS,
	ACCEPTABLE_TIME_PER_MOVE
} from "common/constant"
import { getAvatarUrl, getUTCNow } from "common/helper"
import { emitRoomCreated } from "common/socket"
import { requireAuth, AuthenticatedRequest } from "middleware/auth"
import { Team } from "types/game.type"
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
 *               timeLimit:
 *                 type: integer
 *                 nullable: true
 *                 description: Total seconds per player. null/omitted = no clock. Ignored (forced null) in PvE mode.
 *                 enum: [300, 600, 900, 1200, 1800, 3600]
 *               timeIncrement:
 *                 type: integer
 *                 nullable: true
 *                 description: Seconds added to a player's budget after each completed move (Fischer). 0/null = off. Forced to 0 unless timeLimit is set.
 *                 enum: [0, 3, 5, 15, 30, 60, 90]
 *               timePerMove:
 *                 type: integer
 *                 nullable: true
 *                 description: Hard cap in seconds for a single move; exceeding it flags the mover. 0/null = off. Forced to 0 unless timeLimit is set.
 *                 enum: [0, 30, 60, 90, 120, 180]
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
		const {
			tableName,
			teamName,
			redFirst = true,
			pveMode = false,
			betAmount = 10,
			timeLimit = null,
			timeIncrement = null,
			timePerMove = null
		} = req.body as CreateRoomRequest
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

		// Validate time limit: null/omitted (no clock) or one of the accepted budgets.
		if (
			timeLimit !== null &&
			timeLimit !== undefined &&
			!ACCEPTABLE_TIME_LIMITS.includes(timeLimit)
		) {
			res.status(400).json({
				success: false,
				message: "create-room.messages.invalid-time-limit",
				status_code: 400
			})
			return
		}

		// Increment/per-move are optional add-ons: null/omitted or 0 means off,
		// otherwise one of the accepted values.
		if (
			timeIncrement !== null &&
			timeIncrement !== undefined &&
			timeIncrement !== 0 &&
			!ACCEPTABLE_TIME_INCREMENTS.includes(timeIncrement)
		) {
			res.status(400).json({
				success: false,
				message: "create-room.messages.invalid-time-increment",
				status_code: 400
			})
			return
		}

		if (
			timePerMove !== null &&
			timePerMove !== undefined &&
			timePerMove !== 0 &&
			!ACCEPTABLE_TIME_PER_MOVE.includes(timePerMove)
		) {
			res.status(400).json({
				success: false,
				message: "create-room.messages.invalid-time-per-move",
				status_code: 400
			})
			return
		}

		// Clock applies to PvP only
		const effectiveTimeLimit = pveMode ? null : (timeLimit ?? null)
		const effectiveTimeIncrement = effectiveTimeLimit == null ? 0 : (timeIncrement ?? 0)
		const effectiveTimePerMove = effectiveTimeLimit == null ? 0 : (timePerMove ?? 0)

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

			const existingRooms = await prisma.room.findMany({
				where: { room_users: { some: { user_id: userIdBigInt } } },
				select: { id: true }
			})
			for (const existing of existingRooms) {
				await leaveRoomEffect(existing.id, userIdBigInt)
			}

			// Seed only the requester for PvP rooms. Add a bot seat too in PvE mode,
			// on the team opposite to the requester.
			const roomUserSeed: { user_id: bigint; team: string | null; joined_at: Date }[] = [
				{ user_id: userIdBigInt, team: teamName, joined_at: getUTCNow() }
			]
			if (pveMode) {
				// Determine bot team (opposite of user's team)
				let botTeam: Team = "red"
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
					time_limit: effectiveTimeLimit,
					time_increment: effectiveTimeIncrement,
					time_per_move: effectiveTimePerMove,
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
					time_limit: true,
					time_increment: true,
					time_per_move: true,
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
				...normalizedRoom,
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
