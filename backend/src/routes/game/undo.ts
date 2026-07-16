import { Response, Router } from "express"
import prisma from "prisma"
import { armClock, computeUndoBaseline } from "common/game/game-clock"
import { getUTCTimestamp } from "common/helper"
import { getGameHistoryCollection } from "common/mongodb"
import { getIO } from "common/socket"
import { requireAuth, AuthenticatedRequest } from "middleware/auth"
import { ClockHistoryRecord } from "types/game.type"

const router = Router()

/**
 * @swagger
 * /api/game/undo:
 *   post:
 *     summary: Undo last move(s) in a game
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
 *               - gameId
 *             properties:
 *               gameId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Undo successful
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
 *                   example: undo.messages.success
 *                 status_code:
 *                   type: integer
 *                   example: 200
 *                 data:
 *                   type: array
 *                   description: Deleted game history records
 *                   items:
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                       game_id:
 *                         type: string
 *                       fen:
 *                         type: string
 *                       team:
 *                         type: string
 *                       time_stamp:
 *                         type: integer
 *                 clock:
 *                   type: object
 *                   nullable: true
 *                   description: Countdown snapshot after the rewind (turn restarted from now); null when the game is not clocked.
 *                   properties:
 *                     redMs:
 *                       type: integer
 *                     blackMs:
 *                       type: integer
 *                     activeTeam:
 *                       type: string
 *                       enum: [red, black]
 *                     perMoveRemainingMs:
 *                       type: integer
 *                     serverNow:
 *                       type: integer
 *                     timeLimit:
 *                       type: integer
 *                     timeIncrement:
 *                       type: integer
 *                     timePerMove:
 *                       type: integer
 *       400:
 *         description: Invalid request (game not found, invalid game id, undo limit exceeded, no moves to undo, or delete failed)
 *       401:
 *         description: Unauthorized (not logged in)
 *       403:
 *         description: Forbidden (not in the game, not in the room, or spectator)
 *       500:
 *         description: Internal server error
 */
router.post("/game/undo", requireAuth(), async (req: AuthenticatedRequest, res: Response) => {
	const { gameId } = req.body

	// Validate input
	if (!gameId || typeof gameId !== "string") {
		res.status(400).json({
			success: false,
			message: "undo.messages.invalid-game-id",
			status_code: 400
		})
		return
	}

	try {
		const userId = req.auth?.userId ? BigInt(parseInt(req.auth.userId, 10)) : null
		if (!userId) {
			res.status(401).json({
				success: false,
				message: "undo.messages.unauthorized",
				status_code: 401
			})
			return
		}

		// Get game info to verify it exists and get room_id
		const game = await prisma.game.findUnique({
			where: { id: gameId },
			select: {
				id: true,
				room_id: true,
				time_limit: true,
				game_users: {
					select: { user_id: true }
				}
			}
		})

		if (!game) {
			res.status(400).json({
				success: false,
				message: "undo.messages.game-not-found",
				status_code: 400
			})
			return
		}

		const room = await prisma.room.findUnique({
			where: { id: game.room_id },
			select: { pve_mode: true }
		})
		if (!room?.pve_mode) {
			res.status(403).json({
				success: false,
				message: "undo.messages.pve-only",
				status_code: 403
			})
			return
		}

		// Verify user is part of the game
		const isUserInGame = game.game_users.some(gu => gu.user_id === userId)
		if (!isUserInGame) {
			res.status(403).json({
				success: false,
				message: "undo.messages.not-in-game",
				status_code: 403
			})
			return
		}

		// Get current player's team from room_users
		const roomUser = await prisma.roomUser.findUnique({
			where: {
				room_id_user_id: { room_id: game.room_id, user_id: userId }
			},
			select: { team: true }
		})

		if (!roomUser) {
			res.status(403).json({
				success: false,
				message: "undo.messages.not-in-room",
				status_code: 403
			})
			return
		}

		if (!roomUser.team) {
			res.status(403).json({
				success: false,
				message: "undo.messages.spectator-cannot-undo",
				status_code: 403
			})
			return
		}

		const currentUserTeam = roomUser.team
		const collection = await getGameHistoryCollection()

		const gameHistories = await collection.find({ game_id: gameId }).toArray()

		// Check undo limit (max 1 undo per game, per user)
		const undoRecords = gameHistories
			.filter(record => record.undo === Number(userId))

		if (undoRecords.length >= 1) {
			res.status(400).json({
				success: false,
				message: "undo.messages.undo-limit-exceeded",
				status_code: 400
			})
			return
		}

		if (!gameHistories || gameHistories.length === 0) {
			res.status(400).json({
				success: false,
				message: "undo.messages.no-moves",
				status_code: 400
			})
			return
		}

		// Determine who made the latest move
		const latest = gameHistories[gameHistories.length - 1]

		let recordsToDelete = 0

		if (latest.team === currentUserTeam) {
			// Current user made the last move, delete 2 records (opponent's move + current user's previous move)
			recordsToDelete = 2
		} else {
			// Opponent made the last move, delete only 1 record
			recordsToDelete = 1
		}

		if (gameHistories.length < recordsToDelete) {
			res.status(400).json({
				success: false,
				message: "undo.messages.no-moves",
				status_code: 400
			})
			return
		}

		// Delete records
		const deletedRecords = gameHistories.slice(gameHistories.length - recordsToDelete)

		const idsToDelete = deletedRecords
			.map(record => record._id)

		const deleteResult = await collection.deleteMany({
			_id: { $in: idsToDelete }
		})

		if (deleteResult.deletedCount === 0) {
			res.status(400).json({
				success: false,
				message: "undo.messages.delete-failed",
				status_code: 400
			})
			return
		}

		// Get the last remaining record (oldest record after deletion)
		const remainingRecord = gameHistories[gameHistories.length - recordsToDelete - 1] || null

			// Update the last remaining record with the undo user_id; for clocked games,
			// restart the turn from now and stamp a clock baseline for time already spent.
		const undoUpdate: Record<string, unknown> = { undo: Number(userId) }
		if (game.time_limit != null) {
			const remainingClockRecords: ClockHistoryRecord[] = gameHistories
				.slice(0, gameHistories.length - recordsToDelete)
				.map(record => ({
					team: record.team,
					timeStamp: Number(record.time_stamp),
					fen: record.fen,
					baseline: record.clock_baseline ?? null
				}))
			undoUpdate.time_stamp = getUTCTimestamp()
			undoUpdate.clock_baseline = computeUndoBaseline(remainingClockRecords)
		}
		if (remainingRecord) {
			await collection.updateOne({ _id: remainingRecord._id }, { $set: undoUpdate })
		}

		const clock = game.time_limit != null ? await armClock(gameId) : null

		const previousFen = remainingRecord?.fen || null
		const previousTeam = remainingRecord?.team || null

		// Emit undo event to all clients in the room
		try {
			const io = getIO()
			const roomChannel = `room-${game.room_id}`
			io.to(roomChannel).emit("game-undo", {
				gameId,
				userId: Number(userId),
				previousFen,
				previousTeam,
				movesDeleted: recordsToDelete,
				clock,
			})
		} catch (err) {
			console.error("[Undo] Socket emission error:", err)
		}

		res.status(200).json({
			success: true,
			message: "undo.messages.success",
			status_code: 200,
			data: deletedRecords,
			clock,
		})
	} catch (err) {
		console.error("Undo error:", err)
		res.status(500).json({
			success: false,
			message: "undo.messages.internal-server-error",
			status_code: 500
		})
	}
})

export default router
