import { Response, Router } from "express"
import prisma from "prisma"
import { decorateRoomUsersWithBackReady } from "common/game/post-game.helper"
import { getAvatarUrl } from "common/helper"
import { emitRoomUsersUpdated } from "common/socket"
import { requireAuth, AuthenticatedRequest } from "middleware/auth"
import { ChangeTeamRequest, Team } from "types/game.type"

const router = Router()

/**
 * @swagger
 * /api/game/change-team:
 *   post:
 *     summary: Sit on the opposing team of the host or leave the team to sit out.
 *     description: Only allowed while the room is in the waiting state before the game starts.
 *     tags:
 *       - Game
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
 *               - roomId
 *               - isLeaveToSeat
 *             properties:
 *               roomId:
 *                 type: integer
 *                 format: int64
 *               isLeaveToSeat:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Team updated successfully
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
 *                   example: challenge.messages.success
 *                 status_code:
 *                   type: integer
 *                   example: 200
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
 *         description: Invalid request (invalid room id, room not in waiting state, caller is host, host has no team, insufficient balance, or both team seats are already taken)
 *       401:
 *         description: Unauthorized (missing, invalid, or expired token)
 *       403:
 *         description: Forbidden (caller is not in the room)
 *       404:
 *         description: Room not found
 *       500:
 *         description: Internal server error
 */
router.post("/game/change-team", requireAuth(), async (req: AuthenticatedRequest, res: Response) => {
	const { roomId, isLeaveToSeat } = req.body as ChangeTeamRequest
	const userId = req.auth?.userId

	if (!userId) {
		res.status(401).json({
			success: false,
			message: "auth-middleware.messages.token-required",
			status_code: 401
		})
		return
	}

	if (!Number.isInteger(roomId) || roomId <= 0) {
		res.status(400).json({
			success: false,
			message: "challenge.messages.invalid-room-id",
			status_code: 400
		})
		return
	}

	try {
		const roomIdBigInt = BigInt(roomId)
		const userIdBigInt = BigInt(userId)

		const room = await prisma.room.findUnique({
			where: { id: roomIdBigInt },
			select: { id: true, status: true, host_id: true, bet_amount: true, pve_mode: true }
		})

		if (!room) {
			res.status(404).json({
				success: false,
				message: "challenge.messages.room-not-found",
				status_code: 404
			})
			return
		}

		if (Number(room.status) !== 1) {
			res.status(400).json({
				success: false,
				message: "challenge.messages.room-not-waiting",
				status_code: 400
			})
			return
		}

		const roomUsers = await prisma.roomUser.findMany({
			where: { room_id: roomIdBigInt },
			orderBy: { joined_at: "asc" },
			select: {
				user_id: true,
				team: true,
				joined_at: true,
				users: {
					select: {
						id: true,
						display_name: true,
						avatar_seq: true,
						total_amount: true
					}
				}
			}
		})

		const callerEntry = roomUsers.find(u => u.user_id === userIdBigInt)
		if (!callerEntry) {
			res.status(403).json({
				success: false,
				message: "challenge.messages.not-in-room",
				status_code: 403
			})
			return
		}

		let newTeam: Team | null

		if (isLeaveToSeat) {
			newTeam = null
		} else {
			// Host is the room's designated host
			const host = roomUsers.find(u => u.user_id === room.host_id)

			if (!host) {
				res.status(400).json({
					success: false,
					message: "challenge.messages.host-has-no-team",
					status_code: 400
				})
				return
			}

			if (host.user_id === userIdBigInt) {
				res.status(400).json({
					success: false,
					message: "challenge.messages.caller-is-host",
					status_code: 400
				})
				return
			}

			if (!host.team) {
				res.status(400).json({
					success: false,
					message: "challenge.messages.host-has-no-team",
					status_code: 400
				})
				return
			}

			// Check balance if joining as player in PvP mode
			if (!room.pve_mode) {
				const user = await prisma.user.findUnique({
					where: { id: userIdBigInt },
					select: { total_amount: true }
				})

				if (room.bet_amount * 10 > (user?.total_amount ?? 0) * 8) {
					res.status(400).json({
						success: false,
						message: "challenge.messages.insufficient-amount",
						status_code: 400
					})
					return
				}
			}

			const oppositeTeam: Team = host.team === "red" ? "black" : "red"

				// Return 400 if the opposite seat is already taken by another user.
				// (Covers both "opposite taken" and "both taken" since host occupies one seat.)
			const seatOccupied = roomUsers.some(
				u => u.team === oppositeTeam && u.user_id !== userIdBigInt
			)

			if (seatOccupied) {
				res.status(400).json({
					success: false,
					message: "challenge.messages.both-seats-taken",
					status_code: 400
				})
				return
			}

			newTeam = oppositeTeam
		}

		await prisma.roomUser.update({
			where: {
				room_id_user_id: {
					room_id: roomIdBigInt,
					user_id: userIdBigInt
				}
			},
			data: { team: newTeam }
		})

		const updatedRoomUsers = await prisma.roomUser.findMany({
			where: { room_id: roomIdBigInt },
			orderBy: { joined_at: "asc" },
			select: {
				team: true,
				joined_at: true,
				users: {
					select: {
						id: true,
						display_name: true,
						avatar_seq: true,
						total_amount: true,
						is_bot: true
					}
				}
			}
		})

		const usersPayload = updatedRoomUsers.map(u => ({
			id: Number(u.users.id),
			display_name: u.users.display_name,
			avatar_seq: u.users.avatar_seq,
			avatar_url: getAvatarUrl(u.users.id, u.users.avatar_seq),
			team: u.team,
			total_amount: u.users.total_amount,
			is_bot: u.users.is_bot,
			joined_at: u.joined_at
		}))
		const usersWithBackReady = decorateRoomUsersWithBackReady(Number(roomIdBigInt), usersPayload)

		emitRoomUsersUpdated(Number(roomIdBigInt), usersPayload)

		res.status(200).json({
			success: true,
			message: "challenge.messages.success",
			status_code: 200,
			data: usersWithBackReady
		})
	} catch (err) {
		console.error("[challenge]", err)
		res.status(500).json({
			success: false,
			message: "challenge.messages.internal-server-error",
			status_code: 500
		})
	}
})

export default router
