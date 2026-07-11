import { Response, Router } from "express"
import prisma from "prisma"
import { runEndGameTransaction } from "common/game/end-game.helper"
import { evaluateChessTeamState } from "common/game/chess-state-evaluator"
import { stopClock } from "common/game/game-clock"
import { activatePostGameLock } from "common/game/post-game.helper"
import { syncPlayersPresence } from "common/game/presence-sync"
import { evaluateTeamState } from "common/game/state-evaluator"
import { getVariant, isTeam, otherTeam } from "common/variants"
import { getGameHistoryCollection } from "common/mongodb"
import { emitGameEnded } from "common/socket"
import { requireAuth, AuthenticatedRequest } from "middleware/auth"
import { VerifyStateRequestDto } from "types/game.type"

const router = Router()

/**
 * @swagger
 * /api/game/verify-state:
 *   post:
 *     summary: Verify check/checkmate/stalemate state for a board position
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
 *               - newFen
 *               - checkedTeam
 *             properties:
 *               gameId:
 *                 type: string
 *               newFen:
 *                 type: string
 *                 description: Project FEN board string after the latest move.
 *               checkedTeam:
 *                 type: string
 *                 enum: ["red", "black"]
 *                 description: Team whose general piece safety is being evaluated.
 *     responses:
 *       200:
 *         description: State verified successfully
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
 *                   example: verify-state.messages.success
 *                 status_code:
 *                   type: integer
 *                   example: 200
 *                 data:
 *                   type: object
 *                   properties:
 *                     inCheck:
 *                       type: boolean
 *                     gameEnded:
 *                       type: boolean
 *                     legalMovesCount:
 *                       type: integer
 *                     status:
 *                       type: string
 *                       enum: ["ongoing", "check", "checkmate", "stalemate"]
 *                     checkedTeam:
 *                       type: string
 *                       enum: ["red", "black"]
 *                     winnerId:
 *                       type: integer
 *                       nullable: true
 *       400:
 *         description: Invalid request body (invalid game id, fen, or checked team)
 *       401:
 *         description: Unauthorized (missing, invalid, or expired token)
 *       404:
 *         description: Game not found
 *       500:
 *         description: Internal server error
 */
router.post("/game/verify-state", requireAuth(), async (req: AuthenticatedRequest, res: Response) => {
	const {
		gameId,
		newFen,
		checkedTeam
	} = req.body as VerifyStateRequestDto

	if (!gameId || typeof gameId !== "string") {
		res.status(400).json({
			success: false,
			message: "verify-state.messages.invalid-game-id",
			status_code: 400
		})
		return
	}

	if (!newFen || typeof newFen !== "string") {
		res.status(400).json({
			success: false,
			message: "verify-state.messages.invalid-fen",
			status_code: 400
		})
		return
	}

	try {
		const game = await prisma.game.findUnique({
			where: { id: gameId },
			select: {
				id: true,
				room_id: true,
				game_type: true,
				room: {
					select: {
						bet_amount: true,
						pve_mode: true,
						red_first: true
					}
				}
			}
		})

		if (!game || !game.room) {
			res.status(404).json({
				success: false,
				message: "verify-state.messages.game-not-found",
				status_code: 404
			})
			return
		}

		// Team vocabulary and FEN shape differ per variant, so validate once we
		// know which game this is.
		const variant = getVariant(game.game_type)
		if (!isTeam(variant, checkedTeam)) {
			res.status(400).json({
				success: false,
				message: "verify-state.messages.invalid-team",
				status_code: 400
			})
			return
		}

		if (!variant.validateFen(newFen)) {
			res.status(400).json({
				success: false,
				message: "verify-state.messages.invalid-fen",
				status_code: 400
			})
			return
		}

		const evaluation = variant.gameType === "chess"
			? evaluateChessTeamState(newFen, checkedTeam as "white" | "black")
			: evaluateTeamState(newFen, checkedTeam as "red" | "black", game.room.red_first)
		let gameEnded = false
		let winnerId: number | null = null

		if (evaluation.status === "checkmate" || evaluation.status === "stalemate") {
			const winnerTeam = otherTeam(variant, checkedTeam)
			const roomUsers = await prisma.roomUser.findMany({
				where: { room_id: game.room_id },
				select: {
					team: true,
					user_id: true
				}
			})

			const winner = roomUsers.find(user => user.team === winnerTeam)
			winnerId = winner ? Number(winner.user_id) : null

			const ended = await runEndGameTransaction({
				gameId,
				roomId: game.room_id,
				winnerId: winnerId == null ? null : BigInt(winnerId),
				isBotGame: game.room.pve_mode,
				betAmount: game.room.bet_amount
			})

			if (ended) {
				gameEnded = true
				stopClock(gameId)
				await syncPlayersPresence(gameId, false)
				await activatePostGameLock(game.room_id, gameId)

				const collection = await getGameHistoryCollection()
				const latestRecord = await collection
					.find({
						$or: [{ game_id: gameId }, { gameId }]
					})
					.sort({ _id: -1 })
					.limit(1)
					.toArray()

				if (latestRecord.length > 0) {
					await collection.updateOne(
						{ _id: latestRecord[0]._id },
						{ $set: { winner_id: winnerId } }
					)
				}

				emitGameEnded(Number(game.room_id), {
					gameId,
					status: evaluation.status,
					winnerId
				})
			}
		}

		res.status(200).json({
			success: true,
			message: "verify-state.messages.success",
			status_code: 200,
			data: {
				gameEnded,
				inCheck: evaluation.inCheck,
				legalMovesCount: evaluation.legalMovesCount,
				status: evaluation.status,
				checkedTeam,
				winnerId
			}
		})
	} catch (err) {
		console.error("Verify state error:", err)
		res.status(500).json({
			success: false,
			message: "verify-state.messages.internal-server-error",
			status_code: 500
		})
	}
})

export default router
