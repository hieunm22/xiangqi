import { Response, Router } from "express"
import prisma from "prisma"
import { playBotMove } from "common/bot-engine/play-bot-move"
import { armClock, computeClock } from "common/game/game-clock"
import { getGameHistoryCollection } from "common/mongodb"
import { emitMovePiece } from "common/socket"
import { getUTCTimestamp } from "common/helper"
import { getVariant, isTeam, otherTeam } from "common/variants"
import { requireAuth, AuthenticatedRequest } from "middleware/auth"
import { MovePieceRequest, PVEContext } from "types/game.type"

const router = Router()

/**
 * @swagger
 * /api/game/move-piece:
 *   post:
 *     summary: Record a piece movement in game history
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
 *               - team
 *             properties:
 *               gameId:
 *                 type: string
 *               newFen:
 *                 type: string
 *               capturePiece:
 *                 type: string
 *                 nullable: true
 *                 description: The captured piece (if any)
 *               team:
 *                 type: string
 *                 enum: ["red", "black"]
 *                 description: The team who just moved (the active team)
 *     responses:
 *       201:
 *         description: Move recorded successfully
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
 *                   example: move-piece.messages.success
 *                 status_code:
 *                   type: integer
 *                   example: 201
 *                 data:
 *                   type: object
 *                   properties:
 *                     game_id:
 *                       type: string
 *                     fen:
 *                       type: string
 *                     team:
 *                       type: string
 *                       example: black
 *                     time_stamp:
 *                       type: integer
 *                     capture:
 *                       type: string
 *                       nullable: true
 *                       description: Present only when a piece is captured
 *                     _id:
 *                       type: string
 *       400:
 *         description: Invalid request (invalid game id, invalid fen, invalid team, invalid capture piece, or game history not found)
 *       401:
 *         description: Unauthorized (missing, invalid, or expired token)
 *       500:
 *         description: Internal server error
 */
router.post("/game/move-piece", requireAuth(), async (req: AuthenticatedRequest, res: Response) => {
	const body = req.body as MovePieceRequest
	const {
		gameId,
		newFen,
		team,	// active team (the one who just moved)
		capturePiece
	} = body

	// Validate input
	if (!gameId || typeof gameId !== "string") {
		res.status(400).json({
			success: false,
			message: "move-piece.messages.invalid-game-id",
			status_code: 400
		})
		return
	}

	if (!newFen || typeof newFen !== "string") {
		res.status(400).json({
			success: false,
			message: "move-piece.messages.invalid-fen",
			status_code: 400
		})
		return
	}

	// Validate capturePiece (optional but should be string or null)
	if (capturePiece !== null && capturePiece !== undefined && typeof capturePiece !== "string") {
		res.status(400).json({
			success: false,
			message: "move-piece.messages.invalid-capture-piece",
			status_code: 400
		})
		return
	}

	try {
		// Resolve the variant for this game - it drives FEN and team validation.
		const game = await prisma.game.findUnique({
			where: { id: gameId },
			select: {
				room_id: true,
				bot_difficulty: true,
				game_type: true,
				room: { select: { red_first: true } }
			}
		})
		const variant = getVariant(game?.game_type)

		if (!variant.validateFen(newFen)) {
			res.status(400).json({
				success: false,
				message: "move-piece.messages.invalid-fen",
				status_code: 400
			})
			return
		}

		if (!isTeam(variant, team)) {
			res.status(400).json({
				success: false,
				message: "move-piece.messages.invalid-team",
				status_code: 400
			})
			return
		}

		const collection = await getGameHistoryCollection()

		// Get latest game history record
		const latestRecord = await collection
			.find({ game_id: gameId })
			.sort({ _id: -1 })
			.limit(1)
			.toArray()

		if (!latestRecord || latestRecord.length === 0) {
			res.status(400).json({
				success: false,
				message: "move-piece.messages.game-history-not-found",
				status_code: 400
			})
			return
		}

		// Validate team: ensure request team matches latest record's turn (next team to move)
		const latestTeam = latestRecord[0]?.team
		if (latestTeam !== team) {
			res.status(400).json({
				success: false,
				message: "move-piece.messages.invalid-team",
				status_code: 400
			})
			return
		}

		// Reject a move from a player who has already run out of time
		const preClock = await computeClock(gameId)
		if (preClock) {
			// blackMs is the black seat; redMs is the other seat (red / white).
			// const movingRemaining = team === "black" ? preClock.blackMs : preClock.redMs
			const movingRemaining = team === "red" ? preClock.redMs : preClock.blackMs
			if (movingRemaining <= 0) {
				await armClock(gameId)
				res.status(400).json({
					success: false,
					message: "move-piece.messages.time-expired",
					status_code: 400
				})
				return
			}
		}

		// Calculate next team (toggle)
		const nextTeam = otherTeam(variant, team)

		// Captured piece is stored in the opponent's case per the variant's FEN dialect.
		const capture = capturePiece ? variant.formatCapturedPiece(capturePiece, team) : null

		// Insert new record
		const newRecord: any = {
			game_id: gameId,
			fen: newFen,
			team: nextTeam,
			time_stamp: getUTCTimestamp()
		}

		if (capture) {
			newRecord.capture = capture
		}

		const insertResult = await collection.insertOne(newRecord)

		// Also save to PostgreSQL for test data
		await prisma.gameHistory.create({
			data: {
				game_id: gameId,
				fen: newFen,
				team: nextTeam,
				capture,
				time_stamp: getUTCTimestamp()
			}
		})

		// Reschedule the flag timer for the next player and snapshot the clock
		const clock = await armClock(gameId)

		const responseData: any = {
			...newRecord,
			_id: insertResult.insertedId.toString(),
			clock,
		}

		// Emit move piece event to all clients in the room EXCEPT the requester
		// Also detect PvE games and queue the bot's reply (after responding to the client).
		let pveContext: PVEContext | null = null
		try {
			const userId = req.auth?.userId ? parseInt(req.auth.userId, 10) : undefined
			if (game?.room_id) {
				emitMovePiece(Number(game.room_id), responseData, userId)
				if (game.bot_difficulty != null && game.room) {
					pveContext = {
						roomId: game.room_id,
						redFirst: game.room.red_first,
						botDifficulty: game.bot_difficulty
					}
				}
			} else {
				console.warn(`[Move-Piece] No game found or game has no room_id for gameId: ${gameId}`)
			}
		} catch (socketErr) {
			console.error("[Move-Piece] Socket emission error:", socketErr)
			// Don't fail the request if socket emission fails
		}

		res.status(201).json({
			success: true,
			message: "move-piece.messages.success",
			status_code: 201,
			data: responseData
		})

		// Fire bot reply after responding so the API stays snappy.
		// `nextTeam` is whoever is to move next; in PvE that's always the bot.
		if (pveContext) {
			playBotMove({
				gameId,
				roomId: pveContext.roomId,
				projectFen: newFen,
				redFirst: pveContext.redFirst,
				// Bot play is xiangqi-only today, so the seat is always red/black here.
				botTeam: nextTeam as "red" | "black",
				difficulty: pveContext.botDifficulty
			}).catch(err => {
				console.error(`[Move-Piece] bot reply failed for game ${gameId}:`, err)
			})
		}
	} catch (err) {
		console.error("Move piece error:", err)
		res.status(500).json({
			success: false,
			message: "move-piece.messages.internal-server-error",
			status_code: 500
		})
	}
})

export default router
