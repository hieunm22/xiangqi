import { Response, Router } from "express"
import prisma from "prisma"
import { emitRoomUsersUpdated } from "common/socket"
import { requireAuth, AuthenticatedRequest } from "middleware/auth"
import { JoinRoomRequest } from "types/room.type"
import { getAvatarUrl } from "common/helper"

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
 */
router.post("/room/join", requireAuth(), async (req: AuthenticatedRequest, res: Response) => {
	const { id } = req.body as JoinRoomRequest
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
		const now = new Date()

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

		if (existingRoomUser) {
			// User is already in this room: refresh join timestamp.
			// For PVE rooms, also force team to null (spectator).
			await prisma.roomUser.update({
				where: {
					room_id_user_id: {
						room_id: roomId,
						user_id: userIdBigInt
					}
				},
				data: {
					joined_at: now,
					...(room.pve_mode ? { team: null } : {})
				}
			})
		} else {
			// User is joining a new room.
			// PVE rooms: always spectator (team = null).
			// PVP rooms: assign team by available slot.
			//   - If red or black is missing: assign to that team
			//   - If both teams taken: null team (spectator)
			let assignedTeam: string | null = null

			if (!room.pve_mode) {
				const existingMembers = await prisma.roomUser.findMany({
					where: {
						room_id: roomId
					},
					select: {
						team: true
					},
					orderBy: {
						joined_at: "asc"
					}
				})

				const assignedTeams = new Set(existingMembers.map(m => m.team).filter(t => t !== null))

				if (!assignedTeams.has("red")) {
					assignedTeam = "red"
				} else if (!assignedTeams.has("black")) {
					assignedTeam = "black"
				}
				// If both teams are assigned, assignedTeam remains null (spectator)
			}

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
						avatar_seq: true
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
