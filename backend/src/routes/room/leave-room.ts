import { Response, Router } from "express"
import prisma from "prisma"
import { requireAuth, AuthenticatedRequest } from "middleware/auth"
import { LeaveRoomRequest } from "types/room.type"
import { emitRoomDeleted, emitRoomUsersUpdated } from "common/socket"

const router = Router()

/**
 * @swagger
 * /api/room/leave:
 *   delete:
 *     summary: Leave a room
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
router.delete("/room/leave", requireAuth(), async (req: AuthenticatedRequest, res: Response) => {
	const { id } = req.body as LeaveRoomRequest
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
			message: "leave-room.messages.invalid-room-id",
			status_code: 400
		})
		return
	}

	try {
		const roomId = BigInt(id)
		const currentRoomUser = await prisma.roomUser.findUnique({
			where: {
				room_id_user_id: {
					room_id: roomId,
					user_id: BigInt(userId)
				}
			},
			select: {
				team: true
			}
		})

		if (!currentRoomUser) {
			res.status(404).json({
				success: false,
				message: "leave-room.messages.player-not-in-room",
				status_code: 404
			})
			return
		}

		const deletedRoomUser = await prisma.roomUser.deleteMany({
			where: {
				room_id: roomId,
				user_id: BigInt(userId)
			}
		})

		if (deletedRoomUser.count === 0) {
			res.status(404).json({
				success: false,
				message: "leave-room.messages.player-not-in-room",
				status_code: 404
			})
			return
		}

		if (currentRoomUser.team) {
			const audienceToPromote = await prisma.roomUser.findFirst({
				where: {
					room_id: roomId,
					team: null
				},
				orderBy: {
					joined_at: "asc"
				},
				select: {
					room_id: true,
					user_id: true
				}
			})

			if (audienceToPromote) {
				await prisma.roomUser.update({
					where: {
						room_id_user_id: {
							room_id: audienceToPromote.room_id,
							user_id: audienceToPromote.user_id
						}
					},
					data: {
						team: currentRoomUser.team
					}
				})
			}
		}

		const countRemainingPlayers = await prisma.roomUser.count({
			where: {
				room_id: roomId
			}
		})

		if (countRemainingPlayers === 0) {
			await prisma.room.delete({
				where: {
					id: roomId
				}
			})
			emitRoomDeleted(id)
		} else {
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
				avatar_url:
					Number(roomUser.users.avatar_seq) === 0
						? `/images/${Number(roomUser.users.id)}.jpg`
						: `/images/${Number(roomUser.users.id)}_${Number(roomUser.users.avatar_seq)}.jpg`,
				team: roomUser.team,
				joined_at: roomUser.joined_at
			}))

			emitRoomUsersUpdated(id, formattedUsers)
		}

		res.status(200).json({
			success: true,
			message: "leave-room.messages.success",
			status_code: 200
		})
	} catch (err) {
		console.error("Leave room error:", err)
		res.status(500).json({
			success: false,
			message: "leave-room.messages.internal-server-error",
			status_code: 500
		})
	}
})

export default router
