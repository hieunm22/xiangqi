import { Response, Router } from "express"
import prisma from "prisma"
import { requireAuth, AuthenticatedRequest } from "middleware/auth"
import { runEndGameTransaction } from "common/game/end-game.helper"
import { stopClock } from "common/game/game-clock"
import { activatePostGameLock } from "common/game/post-game.helper"
import { syncPlayersPresence } from "common/game/presence-sync"
import { getGameHistoryCollection } from "common/mongodb"
import { getUTCTimestamp } from "common/helper"
import { SurrenderGameRequest } from "types/game.type"

const router = Router()

/**
 * @swagger
 * /api/game/surrender:
 *   post:
 *     summary: Surrender a game
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
 *         description: Surrender recorded successfully
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
 *                   example: surrender.messages.success
 *                 status_code:
 *                   type: integer
 *                   example: 200
 *       400:
 *         description: Invalid request (invalid game id, game already finished, invalid surrender player, opponent not found, or game history not found)
 *       401:
 *         description: Unauthorized (missing, invalid, or expired token)
 *       404:
 *         description: Game not found
 *       500:
 *         description: Internal server error
 */
router.post("/game/surrender", requireAuth(), async (req: AuthenticatedRequest, res: Response) => {
	const userId = req.auth?.userId
	const { gameId } = req.body as SurrenderGameRequest

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
			message: "surrender.messages.invalid-game-id",
			status_code: 400
		})
		return
	}

	try {
		const normalizedGameId = gameId.trim()
		if (!normalizedGameId) {
			res.status(400).json({
				success: false,
				message: "surrender.messages.invalid-game-id",
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
				message: "surrender.messages.game-not-found",
				status_code: 404
			})
			return
		}

		if (Number(game.status) === 2) {
			res.status(400).json({
				success: false,
				message: "surrender.messages.game-already-finished",
				status_code: 400
			})
			return
		}

		const roomUsers = await prisma.roomUser.findMany({
			where: {
				room_id: game.room_id
			},
			select: {
				user_id: true,
				team: true
			}
		})

		const userIdBigInt = BigInt(userId)
		const surrenderingPlayer = roomUsers.find(
			roomUser => roomUser.user_id === userIdBigInt && (roomUser.team === "red" || roomUser.team === "black")
		)

		if (!surrenderingPlayer || !surrenderingPlayer.team) {
			res.status(400).json({
				success: false,
				message: "surrender.messages.invalid-surrender-player",
				status_code: 400
			})
			return
		}

		const winnerTeam = surrenderingPlayer.team === "red" ? "black" : "red"
		const winner = roomUsers.find(roomUser => roomUser.team === winnerTeam)

		if (!winner) {
			res.status(400).json({
				success: false,
				message: "surrender.messages.opponent-not-found",
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
				message: "surrender.messages.game-history-not-found",
				status_code: 400
			})
			return
		}

		await collection.insertOne({
			game_id: normalizedGameId,
			fen: latestRecord[0].fen,
			team: surrenderingPlayer.team === "red" ? "black" : "red",
			time_stamp: getUTCTimestamp(),
			surrender_id: Number(userId),
			winner_id: Number(winner.user_id),
			end_reason: "surrender"
		})

		// Fetch room to determine PvE mode and bet amount
		const roomWithBet = await prisma.room.findUnique({
			where: { id: game.room_id },
			select: { pve_mode: true, bet_amount: true }
		})

		const ended = await runEndGameTransaction({
			gameId: normalizedGameId,
			roomId: game.room_id,
			winnerId: winner.user_id,
			isBotGame: roomWithBet?.pve_mode ?? false,
			betAmount: roomWithBet?.bet_amount ?? null,
			endReason: "surrender"
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
			message: "surrender.messages.success",
			status_code: 200
		})
	} catch (err) {
		console.error("Surrender game error:", err)
		res.status(500).json({
			success: false,
			message: "surrender.messages.internal-server-error",
			status_code: 500
		})
	}
})

export default router