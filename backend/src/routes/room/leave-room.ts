import { Response, Router } from "express"
import prisma from "prisma"
import { BOT_USER_ID, engineManager } from "common/bot-engine"
import { buildEndGameTransaction } from "common/game/end-game.helper"
import { getAvatarUrl, getUTCTimestamp } from "common/helper"
import { getGameHistoryCollection } from "common/mongodb"
import { emitRoomDeleted, emitRoomUsersUpdated } from "common/socket"
import { requireAuth, AuthenticatedRequest } from "middleware/auth"
import { LeaveRoomRequest } from "types/room.type"

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
 *     responses:
 *       200:
 *         description: Left room successfully
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
 *                   example: leave-room.messages.success
 *                 status_code:
 *                   type: integer
 *                   example: 200
 *       400:
 *         description: Invalid room id
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Room not found or player not in room
 *       500:
 *         description: Internal server error
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
		const userIdBigInt = BigInt(userId)

		const room = await prisma.room.findUnique({
			where: { id: roomId },
			select: { id: true, pve_mode: true, status: true, bet_amount: true, host_id: true }
		})
		if (!room) {
			res.status(404).json({
				success: false,
				message: "leave-room.messages.room-not-found",
				status_code: 404
			})
			return
		}

		const roomUsers = await prisma.roomUser.findMany({
			where: { room_id: roomId },
			select: {
				user_id: true,
				team: true,
				joined_at: true,
				users: {
					select: {
						id: true,
						display_name: true,
						avatar_seq: true
					}
				}
			},
			orderBy: { joined_at: "asc" }
		})

		const currentRoomUser = roomUsers.find(ru => ru.user_id === userIdBigInt)
		if (!currentRoomUser) {
			res.status(404).json({
				success: false,
				message: "leave-room.messages.player-not-in-room",
				status_code: 404
			})
			return
		}

		const isHostLeaving = room.host_id === userIdBigInt

		// Spectator (team = null) leaving: just remove and emit updated list
		if (!currentRoomUser.team) {
			await prisma.roomUser.deleteMany({
				where: { room_id: roomId, user_id: userIdBigInt }
			})

			const remainingCount = await prisma.roomUser.count({
				where: { room_id: roomId }
			})

			if (remainingCount === 0) {
				await prisma.room.update({
					where: { id: roomId },
					data: { is_active: false }
				})
				emitRoomDeleted(id)
			} else {
				const remaining = roomUsers.filter(ru => ru.user_id !== userIdBigInt)
				const formattedUsers = formatRoomUsers(remaining)
				if (isHostLeaving) {
					const newHostId = await reassignHost(roomId, remaining)
					emitRoomUsersUpdated(id, formattedUsers, newHostId)
				} else {
					emitRoomUsersUpdated(id, formattedUsers)
				}
			}

			res.status(200).json({
				success: true,
				message: "leave-room.messages.success",
				status_code: 200
			})
			return
		}

		// Player leaving: end active game (like surrender) then remove only this player
		const activeGame = await prisma.game.findFirst({
			where: { room_id: roomId, status: 1 },
			select: { id: true }
		})

		let winnerId: bigint | null = null
		if (activeGame) {
			if (room.pve_mode) {
				winnerId = BOT_USER_ID
			} else {
				// PvP: opponent wins
				const opponent = roomUsers.find(ru => ru.team && ru.team !== currentRoomUser.team)
				if (opponent) {
					winnerId = opponent.user_id
				}
			}

			if (winnerId) {
				const collection = await getGameHistoryCollection()
				const latestRecord = await collection
					.find({ $or: [{ game_id: activeGame.id }, { gameId: activeGame.id }] })
					.sort({ _id: -1 })
					.limit(1)
					.toArray()

				const winnerTeam = currentRoomUser.team === "red" ? "black" : "red"
				if (latestRecord?.length > 0 && latestRecord[0]?.fen) {
					await collection.insertOne({
						game_id: activeGame.id,
						fen: latestRecord[0].fen,
						team: winnerTeam,
						time_stamp: getUTCTimestamp(),
						leave: Number(userId)
					})
				}

				const transactionUpdates = await buildEndGameTransaction({
					gameId: activeGame.id,
					roomId,
					winnerId,
					isBotGame: room.pve_mode,
					betAmount: room.bet_amount
				})

				await prisma.$transaction(transactionUpdates)

				engineManager.releaseEngine(activeGame.id).catch(err => {
					console.error(`[leave-room] failed to release engine for game ${activeGame.id}:`, err)
				})
			}
		}

		// In PvE mode, remove all users and deactivate room
		if (room.pve_mode) {
			await prisma.roomUser.deleteMany({
				where: { room_id: roomId }
			})

			await prisma.room.update({
				where: { id: roomId },
				data: { is_active: false }
			})

			emitRoomDeleted(id)
		} else {
			// In PvP mode, only remove the leaving player
			await prisma.roomUser.deleteMany({
				where: { room_id: roomId, user_id: userIdBigInt }
			})

			const remainingCount = await prisma.roomUser.count({
				where: { room_id: roomId }
			})

			// Deactivate room only if no users remain
			if (remainingCount === 0) {
				await prisma.room.update({
					where: { id: roomId },
					data: { is_active: false }
				})
				emitRoomDeleted(id)
			} else {
				// Emit updated user list with remaining players/spectators
				const remaining = roomUsers.filter(ru => ru.user_id !== userIdBigInt)
				const formattedUsers = formatRoomUsers(remaining)
				if (isHostLeaving) {
					const newHostId = await reassignHost(roomId, remaining)
					emitRoomUsersUpdated(id, formattedUsers, newHostId)
				} else {
					emitRoomUsersUpdated(id, formattedUsers)
				}
			}
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

// When the host leaves a PvP room that still has members, transfer the host
// role to the earliest-joined remaining real user (bots can never be host).
// `remaining` is expected to be ordered by joined_at ascending.
async function reassignHost(roomId: bigint, remaining: { user_id: bigint }[]): Promise<number | null> {
	const newHost = remaining.find(ru => ru.user_id !== BOT_USER_ID)
	const newHostId = newHost ? newHost.user_id : null
	await prisma.room.update({
		where: { id: roomId },
		data: { host_id: newHostId }
	})
	return newHostId === null ? null : Number(newHostId)
}

function formatRoomUsers(roomUsers: any[]) {
	return roomUsers.map(roomUser => ({
		id: Number(roomUser.users.id),
		display_name: roomUser.users.display_name,
		avatar_seq: Number(roomUser.users.avatar_seq),
		avatar_url: getAvatarUrl(roomUser.users.id, roomUser.users.avatar_seq),
		team: roomUser.team,
		joined_at: roomUser.joined_at
	}))
}

export default router
