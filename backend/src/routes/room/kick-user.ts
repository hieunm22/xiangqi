import { Response, Router } from "express"
import prisma from "prisma"
import { emitRoomUsersUpdated, emitUserKicked } from "common/socket"
import { requireAuth, AuthenticatedRequest } from "middleware/auth"
import { KickUserRequest, RoomStatus } from "types/room.type"
import { getAvatarUrl } from "common/helper"

const router = Router()

/**
 * @swagger
 * /api/room/kick:
 *   post:
 *     summary: Kick a user from a room (host only)
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
 *               - userId
 *             properties:
 *               id:
 *                 type: integer
 *                 format: int64
 *                 description: Room ID
 *               userId:
 *                 type: integer
 *                 format: int64
 *                 description: ID of the user to kick
 *     responses:
 *       200:
 *         description: User has been kicked
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
 *                   example: kick-user.messages.success
 *                 status_code:
 *                   type: integer
 *                   example: 200
 *       400:
 *         description: Invalid request, kicking yourself, or room is not waiting
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (not the host)
 *       404:
 *         description: Room or target user not found
 *       500:
 *         description: Internal server error
 */
router.post("/room/kick", requireAuth(), async (req: AuthenticatedRequest, res: Response) => {
	const { id, userId: targetUserId } = req.body as KickUserRequest
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
			message: "kick-user.messages.invalid-room-id",
			status_code: 400
		})
		return
	}

	if (!Number.isInteger(targetUserId) || targetUserId <= 0) {
		res.status(400).json({
			success: false,
			message: "kick-user.messages.invalid-user-id",
			status_code: 400
		})
		return
	}

	// You cannot kick yourself
	if (Number(userId) === targetUserId) {
		res.status(400).json({
			success: false,
			message: "kick-user.messages.cannot-kick-self",
			status_code: 400
		})
		return
	}

	try {
		const roomId = BigInt(id)
		const userIdBigInt = BigInt(userId)
		const targetUserIdBigInt = BigInt(targetUserId)

		const room = await prisma.room.findUnique({
			where: { id: roomId },
			select: { id: true, status: true, host_id: true }
		})

		if (!room) {
			res.status(404).json({
				success: false,
				message: "kick-user.messages.room-not-found",
				status_code: 404
			})
			return
		}

		// Only the host can kick users
		if (room.host_id !== userIdBigInt) {
			res.status(403).json({
				success: false,
				message: "kick-user.messages.forbidden",
				status_code: 403
			})
			return
		}

		// Can only kick while the room is waiting (not during a game)
		if (room.status !== RoomStatus.Waiting) {
			res.status(400).json({
				success: false,
				message: "kick-user.messages.room-not-waiting",
				status_code: 400
			})
			return
		}

		const targetUser = await prisma.roomUser.findUnique({
			where: {
				room_id_user_id: {
					room_id: roomId,
					user_id: targetUserIdBigInt
				}
			},
			select: { team: true }
		})

		if (!targetUser) {
			res.status(404).json({
				success: false,
				message: "kick-user.messages.user-not-in-room",
				status_code: 404
			})
			return
		}

		await prisma.roomUser.delete({
			where: {
				room_id_user_id: {
					room_id: roomId,
					user_id: targetUserIdBigInt
				}
			}
		})

		const roomUsers = await prisma.roomUser.findMany({
			where: { room_id: roomId },
			select: {
				joined_at: true,
				team: true,
				users: {
					select: {
						id: true,
						display_name: true,
						avatar_seq: true,
						is_bot: true
					}
				}
			},
			orderBy: { joined_at: "asc" }
		})

		const formattedUsers = roomUsers.map(roomUser => ({
			id: Number(roomUser.users.id),
			display_name: roomUser.users.display_name,
			avatar_seq: Number(roomUser.users.avatar_seq),
			avatar_url: getAvatarUrl(roomUser.users.id, roomUser.users.avatar_seq),
			team: roomUser.team,
			is_bot: roomUser.users.is_bot,
			joined_at: roomUser.joined_at
		}))

		emitUserKicked(id, targetUserId)
		emitRoomUsersUpdated(id, formattedUsers)

		res.status(200).json({
			success: true,
			message: "kick-user.messages.success",
			status_code: 200
		})
	} catch (error) {
		console.error("[kick-user] Error:", error)
		res.status(500).json({
			success: false,
			message: "kick-user.messages.internal-server-error",
			status_code: 500
		})
	}
})

export default router
