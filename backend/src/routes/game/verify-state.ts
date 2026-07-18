import { Response, Router } from "express"
import prisma from "prisma"
import { fenToBoard, hasAttackingMaterial, parseFenCounters } from "common/board-helper"
import { NATURAL_MOVE_LIMIT_PLIES } from "common/constant"
import { concludeGame } from "common/game/conclude-game.helper"
import { evaluatePerpetualCheck } from "common/game/perpetual-check.helper"
import { evaluateTeamState } from "common/game/state-evaluator"
import { getGameHistoryCollection } from "common/mongodb"
import { emitPerpetualCheckWarning } from "common/socket"
import { requireAuth, AuthenticatedRequest } from "middleware/auth"
import { GameEndReason, Team, VerifyStateRequestDto } from "types/game.type"

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
 *                     occurrences:
 *                       type: integer
 *                       description: Number of times the current checking position has recurred in the game.
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

	if (checkedTeam !== "red" && checkedTeam !== "black") {
		res.status(400).json({
			success: false,
			message: "verify-state.messages.invalid-team",
			status_code: 400
		})
		return
	}

	try {
		fenToBoard(newFen)
	} catch {
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

		const evaluation = evaluateTeamState(newFen, checkedTeam, game.room.red_first)
		let gameEnded = false
		let winnerId: number | null = null
		let endStatus: string = evaluation.status
		// Number of times the current checking position has recurred in the game.
		let occurrences = 0

		// End the game for `winnerTeam` (null = draw) via the shared conclude helper.
		const finalizeGameEnd = async (winnerTeam: Team | null, statusForEvent: GameEndReason) => {
			const result = await concludeGame({
				gameId,
				roomId: game.room_id,
				winnerTeam,
				isBotGame: game.room.pve_mode,
				betAmount: game.room.bet_amount,
				statusForEvent
			})

			winnerId = result.winnerId
			if (result.ended) {
				gameEnded = true
				endStatus = statusForEvent
			}
		}

		// No-progress ply count, resets only on a capture or forward soldier advance.
		let plyCount = 0
		try {
			const collection = await getGameHistoryCollection()
			const latest = await collection
				.find({ $or: [{ game_id: gameId }, { gameId }] })
				.sort({ _id: -1 })
				.limit(1)
				.toArray()
			if (latest.length > 0 && typeof latest[0].fen === "string") {
				plyCount = parseFenCounters(latest[0].fen).halfmove
			}
		} catch (err) {
			console.error(`[Verify-State] failed to read ply counter for game ${gameId}:`, err)
		}

		if (evaluation.status === "checkmate" || evaluation.status === "stalemate") {
			// The checked/stalemated side loses; its opponent wins.
			const winnerTeam = checkedTeam === "red" ? "black" : "red"
			await finalizeGameEnd(winnerTeam, evaluation.status)
		} else if (
			!hasAttackingMaterial(newFen, "red") &&
			!hasAttackingMaterial(newFen, "black")
		) {
			// Neither side has any attacking piece left
			await finalizeGameEnd(null, "draw")
		} else if (plyCount >= NATURAL_MOVE_LIMIT_PLIES) {
			// Natural move-limit: too long with no capture and no forward soldier advance.
			await finalizeGameEnd(null, "draw")
		} else if (evaluation.inCheck) {
				// Check if this move creates a perpetual check.
				// "loss" = checker loses (checkedTeam wins); "warning" = one repetition away, notify both.
			const perpetual = await evaluatePerpetualCheck(gameId, newFen, checkedTeam, game.room.red_first)
			occurrences = perpetual.occurrencesCount
			if (perpetual.status === "loss") {
				await finalizeGameEnd(checkedTeam, "perpetual-check")
			} else if (perpetual.status === "warning") {
				const offenderTeam = checkedTeam === "red" ? "black" : "red"
				emitPerpetualCheckWarning(Number(game.room_id), { gameId, offenderTeam, checkedTeam })
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
				status: endStatus,
				checkedTeam,
				winnerId,
				occurrences
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
