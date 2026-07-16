import { Response, Router } from "express"
import prisma from "prisma"
import { leaveRoomEffect } from "common/game/leave-room.helper"
import { decorateRoomUsersWithBackReady } from "common/game/post-game.helper"
import { getAvatarUrl, getUTCNow } from "common/helper"
import { emitRoomUsersUpdated } from "common/socket"
import { requireAuth, AuthenticatedRequest } from "middleware/auth"
import { Team } from "types/game.type"
import { JoinRoomRequest } from "types/room.type"

const router = Router()

/**
 * @swagger
 * /api/room/join:
 *   post:
 *     summary: Join a room
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
 *             properties:
 *               id:
 *                 type: integer
 *                 format: int64
 *               team:
 *                 type: string
 *                 enum: [red, black]
 *                 nullable: true
 *                 description: Optional preferred team. Use null for spectator and omit for auto-assign.
 *     responses:
 *       201:
 *         description: Joined room successfully
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
 *                   example: join-room.messages.success
 *                 status_code:
 *                   type: integer
 *                   example: 201
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       display_name:
 *                         type: string
 *                       avatar_seq:
 *                         type: integer
 *                       avatar_url:
 *                         type: string
 *                       team:
 *                         type: string
 *                         nullable: true
 *                       total_amount:
 *                         type: integer
 *                       joined_at:
 *                         type: string
 *                         format: date-time
 *       400:
 *         description: Invalid room id
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Room not found
 *       500:
 *         description: Internal server error
 */
router.post("/room/join", requireAuth(), async (req: AuthenticatedRequest, res: Response) => {
	const { id, team } = req.body as JoinRoomRequest
	const userId = req.auth?.userId

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
			message: "join-room.messages.invalid-room-id",
			status_code: 400
		})
		return
	}

	if (team !== undefined && team !== null && team !== "red" && team !== "black") {
		res.status(400).json({
			success: false,
			message: "join-room.messages.invalid-team",
			status_code: 400
		})
		return
	}

	try {
		const roomId = BigInt(id)
		// Check if room exists
		const room = await prisma.room.findUnique({
			where: { id: roomId },
			select: { id: true, pve_mode: true, bet_amount: true }
		})

		if (!room) {
			res.status(404).json({
				success: false,
				message: "join-room.messages.room-not-found",
				status_code: 404
			})
			return
		}

		const userIdBigInt = BigInt(userId)

		// Check balance if joining as player (team is 'red' or 'black', not null)
		if (team !== null && team !== undefined) {
			const user = await prisma.user.findUnique({
				where: { id: userIdBigInt },
				select: { total_amount: true }
			})

			if (room.bet_amount * 10 > (user?.total_amount ?? 0) * 8) {
				res.status(400).json({
					success: false,
					message: "join-room.messages.insufficient-amount",
					status_code: 400
				})
				return
			}
		}
		const now = getUTCNow()

		const otherRooms = await prisma.room.findMany({
			where: {
				id: { not: roomId },
				room_users: { some: { user_id: userIdBigInt } }
			},
			select: { id: true }
		})
		for (const other of otherRooms) {
			await leaveRoomEffect(other.id, userIdBigInt)
		}

		const existingRoomUser = await prisma.roomUser.findUnique({
			where: {
				room_id_user_id: {
					room_id: roomId,
					user_id: userIdBigInt
				}
			}
		})

		let assignedTeam: Team | null = null

		if (!room.pve_mode) {
			const existingMembers = await prisma.roomUser.findMany({
				where: {
					room_id: roomId
				},
				select: {
					team: true,
					user_id: true
				}
			})

			if (team !== undefined) {
				if (team === null) {
					assignedTeam = null
				} else {
					const occupiedByOther = existingMembers.some(
						member => member.team === team && member.user_id !== userIdBigInt
					)

					if (occupiedByOther) {
						res.status(409).json({
							success: false,
							message: "join-room.messages.team-seat-occupied",
							status_code: 409
						})
						return
					}

					assignedTeam = team
				}
			} else {
				const assignedTeams = new Set(
					existingMembers
						.filter(member => member.user_id !== userIdBigInt)
						.map(member => member.team)
						.filter(existingTeam => existingTeam !== null)
				)

				if (!assignedTeams.has("red")) {
					assignedTeam = "red"
				} else if (!assignedTeams.has("black")) {
					assignedTeam = "black"
				}
			}
		}

		if (existingRoomUser) {
			await prisma.roomUser.update({
				where: {
					room_id_user_id: {
						room_id: roomId,
						user_id: userIdBigInt
					}
				},
				data: {
					joined_at: now,
					team: assignedTeam
				}
			})
		} else {
			await prisma.roomUser.create({
				data: {
					room_id: roomId,
					user_id: userIdBigInt,
					team: assignedTeam,
					joined_at: now
				}
			})
		}

		// Fetch all users joined in this room, ordered by joined_at
		const roomUsers = await prisma.roomUser.findMany({
			where: {
				room_id: roomId
			},
			select: {
				joined_at: true,
				team: true,
				users: {
					select: {
						id: true,
						display_name: true,
						avatar_seq: true,
						total_amount: true,
						is_bot: true
					}
				}
			},
			orderBy: {
				joined_at: "asc"
			}
		})

		const formattedUsers = roomUsers.map(roomUser => ({
			id: Number(roomUser.users.id),
			display_name: roomUser.users.display_name,
			avatar_seq: Number(roomUser.users.avatar_seq),
			avatar_url: getAvatarUrl(roomUser.users.id, roomUser.users.avatar_seq),
			team: roomUser.team,
			total_amount: roomUser.users.total_amount,
			is_bot: roomUser.users.is_bot,
			joined_at: roomUser.joined_at
		}))
		const usersWithBackReady = decorateRoomUsersWithBackReady(id, formattedUsers)

		emitRoomUsersUpdated(id, formattedUsers)

		res.status(201).json({
			success: true,
			message: "join-room.messages.success",
			status_code: 201,
			data: usersWithBackReady
		})
	} catch (error) {
		console.error("Error joining room:", error)
		res.status(500).json({
			success: false,
			message: "join-room.messages.internal-server-error",
			status_code: 500
		})
	}
})

export default router
