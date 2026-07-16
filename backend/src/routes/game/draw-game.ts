import { Response, Router } from "express"
import prisma from "prisma"
import { getUTCTimestamp } from "common/helper"
import { runEndGameTransaction } from "common/game/end-game.helper"
import { stopClock } from "common/game/game-clock"
import { activatePostGameLock } from "common/game/post-game.helper"
import { syncPlayersPresence } from "common/game/presence-sync"
import { getGameHistoryCollection } from "common/mongodb"
import { requireAuth, AuthenticatedRequest } from "middleware/auth"
import { DrawGameRequest } from "types/game.type"

const router = Router()

/**
 * @swagger
 * /api/game/draw-game:
 *   post:
 *     summary: End a game as draw
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
 *         description: Draw recorded successfully
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
 *                   example: draw-game.messages.success
 *                 status_code:
 *                   type: integer
 *                   example: 200
 *       400:
 *         description: Invalid request (invalid game id, game already finished, or game history not found)
 *       401:
 *         description: Unauthorized (missing, invalid, or expired token)
 *       403:
 *         description: Forbidden (not in the room or a spectator)
 *       404:
 *         description: Game not found
 *       500:
 *         description: Internal server error
 */
router.post("/game/draw-game", requireAuth(), async (req: AuthenticatedRequest, res: Response) => {
	const userId = req.auth?.userId
	const { gameId } = req.body as DrawGameRequest

	if (!userId) {
		res.status(401).json({
			success: false,
			message: "auth-middleware.messages.token-required",
			status_code: 401
		})
		return
	}

	if (!gameId || typeof gameId !== "string") {
		res.status(400).json({
			success: false,
			message: "draw-game.messages.invalid-game-id",
			status_code: 400
		})
		return
	}

	try {
		const normalizedGameId = gameId.trim()
		if (!normalizedGameId) {
			res.status(400).json({
				success: false,
				message: "draw-game.messages.invalid-game-id",
				status_code: 400
			})
			return
		}

		const game = await prisma.game.findUnique({
			where: {
				id: normalizedGameId
			},
			select: {
				id: true,
				room_id: true,
				status: true
			}
		})

		if (!game) {
			res.status(404).json({
				success: false,
				message: "draw-game.messages.game-not-found",
				status_code: 404
			})
			return
		}

		const roomUsers = await prisma.roomUser.findMany({
			where: {
				room_id: game.room_id
			},
			orderBy: {
				joined_at: "asc"
			},
			select: {
				user_id: true,
				team: true
			}
		})

		const currentRoomUserIndex = roomUsers.findIndex(roomUser => roomUser.user_id === BigInt(userId))
		const currentRoomUser = currentRoomUserIndex >= 0 ? roomUsers[currentRoomUserIndex] : null
		const isNotInRoom = !currentRoomUser
		const isAudience = currentRoomUser?.team === null || currentRoomUserIndex >= 2

		if (isNotInRoom || isAudience) {
			res.status(403).json({
				success: false,
				message: "draw-game.messages.forbidden",
				status_code: 403
			})
			return
		}

		if (Number(game.status) === 2) {
			res.status(400).json({
				success: false,
				message: "draw-game.messages.game-already-finished",
				status_code: 400
			})
			return
		}

		const collection = await getGameHistoryCollection()
		const latestRecord = await collection
			.find({
				$or: [{ game_id: normalizedGameId }, { gameId: normalizedGameId }]
			})
			.sort({ _id: -1 })
			.limit(1)
			.toArray()

		if (!latestRecord || latestRecord.length === 0 || !latestRecord[0]?.fen) {
			res.status(400).json({
				success: false,
				message: "draw-game.messages.game-history-not-found",
				status_code: 400
			})
			return
		}

		await collection.insertOne({
			game_id: normalizedGameId,
			fen: latestRecord[0].fen,
			team: currentRoomUser.team === "red" ? "black" : "red",
			draw: Number(userId),
			time_stamp: getUTCTimestamp(),
			end_reason: "draw"
		})

		const roomWithMode = await prisma.room.findUnique({
			where: { id: game.room_id },
			select: { pve_mode: true }
		})

		const ended = await runEndGameTransaction({
			gameId: normalizedGameId,
			roomId: game.room_id,
			winnerId: null,
			isBotGame: roomWithMode?.pve_mode ?? false,
			betAmount: 0,
			endReason: "draw"
		})

		// Game over — clear players' "busy" presence back to their live status.
		// Skip when another request already ended the game to avoid duplicate work.
		if (ended) {
			stopClock(normalizedGameId)
			await syncPlayersPresence(normalizedGameId, false)
			await activatePostGameLock(game.room_id, normalizedGameId)
		}

		res.status(200).json({
			success: true,
			message: "draw-game.messages.success",
			status_code: 200
		})
	} catch (err) {
		console.error("Draw game error:", err)
		res.status(500).json({
			success: false,
			message: "draw-game.messages.internal-server-error",
			status_code: 500
		})
	}
})

export default router
