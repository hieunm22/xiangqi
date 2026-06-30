import { Response, Router } from "express"
import prisma from "prisma"
import { getAvatarUrl } from "common/helper"
import { PresenceStatus, getActiveUserStatuses } from "common/presence"
import { requireAuth, AuthenticatedRequest } from "middleware/auth"
import { RoomStatus } from "types/room.type"

const router = Router()

/**
 * @swagger
 * /api/game/online:
 *   get:
 *     summary: List users currently online
 *     tags:
 *       - Game
 *     security:
 *       - basicAuth: []
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Online users fetched successfully
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
 *                   example: get-online.messages.success
 *                 status_code:
 *                   type: integer
 *                   example: 200
 *                 data:
 *                   type: object
 *                   properties:
 *                     count:
 *                       type: integer
 *                     users:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: integer
 *                           display_name:
 *                             type: string
 *                           avatar_seq:
 *                             type: integer
 *                           avatar_url:
 *                             type: string
 *                           status:
 *                             type: string
 *                             enum: [online, inactive]
 *       401:
 *         description: Unauthorized (missing, invalid, or expired token)
 *       500:
 *         description: Internal server error
 */
router.get("/game/online", requireAuth(), async (_req: AuthenticatedRequest, res: Response) => {
	try {
		// Heartbeat-derived presence (online / inactive).
		const statuses = await getActiveUserStatuses()
		const statusById = new Map<number, PresenceStatus>()
		statuses.forEach(entry => statusById.set(entry.userId, entry.status))

		// Busy = a player (has a team, not a spectator) in a room whose game is in
		// progress. Overrides heartbeat status, and is included even if their
		// heartbeat isn't currently fresh. Bots excluded.
		const busyPlayers = await prisma.roomUser.findMany({
			where: {
				team: { not: null },
				rooms: { status: RoomStatus.Playing },
				users: { is_bot: false }
			},
			select: { user_id: true }
		})
		busyPlayers.forEach(player => statusById.set(Number(player.user_id), "busy"))

		if (statusById.size === 0) {
			res.status(200).json({
				success: true,
				message: "get-online.messages.success",
				status_code: 200,
				data: { count: 0, users: [] }
			})
			return
		}

		const userIds = [...statusById.keys()]

		const users = await prisma.user.findMany({
			where: {
				id: { in: userIds.map(id => BigInt(id)) },
				is_bot: false
			},
			select: {
				id: true,
				display_name: true,
				avatar_seq: true
			}
		})

		const formattedUsers = users.map(user => ({
			id: Number(user.id),
			display_name: user.display_name,
			avatar_url: getAvatarUrl(user.id, user.avatar_seq),
			status: statusById.get(Number(user.id))
		}))

		res.status(200).json({
			success: true,
			message: "get-online.messages.success",
			status_code: 200,
			data: { count: formattedUsers.length, users: formattedUsers }
		})
	} catch (err) {
		console.error("Get online users error:", err)
		res.status(500).json({
			success: false,
			message: "get-online.messages.internal-server-error",
			status_code: 500,
			data: { count: 0, users: [] }
		})
	}
})

export default router
