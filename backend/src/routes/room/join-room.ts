import { Response, Router } from "express"
import prisma from "prisma"
import { getAvatarUrl, getUTCNow } from "common/helper"
import { emitRoomUsersUpdated } from "common/socket"
import { requireAuth, AuthenticatedRequest } from "middleware/auth"
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
 *                       total_points:
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
			select: { id: true, pve_mode: true }
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
		const now = getUTCNow()

		// Remove user from all other rooms to ensure single-room participation
		await prisma.roomUser.deleteMany({
			where: {
				user_id: userIdBigInt,
				room_id: {
					not: roomId
				}
			}
		})

		const existingRoomUser = await prisma.roomUser.findUnique({
			where: {
				room_id_user_id: {
					room_id: roomId,
					user_id: userIdBigInt
				}
			}
		})

		let assignedTeam: "red" | "black" | null = null

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
						total_points: true
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
			total_points: roomUser.users.total_points,
			joined_at: roomUser.joined_at
		}))

		emitRoomUsersUpdated(id, formattedUsers)

		res.status(201).json({
			success: true,
			message: "join-room.messages.success",
			status_code: 201,
			data: formattedUsers
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
