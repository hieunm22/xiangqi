import { Response, Router } from "express"
import prisma from "prisma"
import { BOT_USER_ID } from "common/bot-engine"
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
 *                 message:
 *                   type: string
 *                 status_code:
 *                   type: integer
 *                 room:
 *                   type: object
 *       400:
 *         description: Invalid request body
 *       401:
 *         description: Unauthorized
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
		if (betAmount === undefined || betAmount === null || !ACCEPTABLE_BET_AMOUNTS.includes(betAmount)) {
			res.status(400).json({
				success: false,
				message: "create-room.messages.invalid-bet-amount",
				status_code: 400
			})
			return
		}

		try {
			const userIdBigInt = BigInt(userId!)

			// Remove existing room_users records for this user
			await prisma.roomUser.deleteMany({
				where: {
					user_id: userIdBigInt
				}
			})

			// Seed only the requester for PvP rooms. Add a bot seat too in PvE mode,
			// on the team opposite to the requester.
			const roomUserSeed: { user_id: bigint; team: string | null; joined_at: Date }[] = [
				{ user_id: userIdBigInt, team: teamName, joined_at: new Date() }
			]
			if (pveMode) {
				// Determine bot team (opposite of user's team)
				let botTeam: "red" | "black" = "red"
				if (teamName === "red") {
					botTeam = "black"
				}
				roomUserSeed.push({ user_id: BOT_USER_ID, team: botTeam, joined_at: new Date() })
			}

			const room = await prisma.room.create({
				data: {
					name: tableName,
					status: 1, // 1 = waiting for opponent
					red_first: redFirst,
					pve_mode: pveMode,
					bet_amount: betAmount,
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

			// Format response
			const formattedRoom = {
				...room,
				id: Number(room.id),
				users: room.room_users.map((gu: any) => ({
					...gu.users,
					id: gu.users.id.toString(),
					team: gu.team,
					avatar_url:
						gu.users.avatar_seq === 0
							? `/images/${gu.users.id.toString()}.jpg`
							: `/images/${gu.users.id.toString()}_${gu.users.avatar_seq}.jpg`
				})),
				room_users: undefined
			}
			delete (formattedRoom as any).room_users

			const dashboardRoom = {
				id: Number(room.id),
				name: room.name,
				status: room.status,
				red_first: room.red_first,
				bet_amount: room.bet_amount,
				created_at: room.created_at,
				updated_at: room.updated_at,
				users: room.room_users.map(gu => ({
					id: Number(gu.users.id),
					display_name: gu.users.display_name,
					avatar_seq: Number(gu.users.avatar_seq),
					avatar_url:
						Number(gu.users.avatar_seq) === 0
							? `/images/${Number(gu.users.id)}.jpg`
							: `/images/${Number(gu.users.id)}_${Number(gu.users.avatar_seq)}.jpg`
				}))
			}
			emitRoomCreated(dashboardRoom)

			res.status(201).json({
				success: true,
				message: "create-room.messages.room-created",
				status_code: 201,
				room: formattedRoom
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
