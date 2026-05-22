import { Response, Router } from "express"
import prisma from "prisma"
import { fenToBoard } from "common/board-helper"
import { getGameHistoryCollection } from "common/mongodb"
import { emitMovePiece } from "common/socket"
import { requireAuth, AuthenticatedRequest } from "middleware/auth"
import { MovePieceRequest } from "types/game.type"

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
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
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

	try {
		fenToBoard(newFen)
	} catch {
		res.status(400).json({
			success: false,
			message: "move-piece.messages.invalid-fen",
			status_code: 400
		})
		return
	}

	if (team !== "red" && team !== "black") {
		res.status(400).json({
			success: false,
			message: "move-piece.messages.invalid-team",
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

		// Calculate next team (toggle)
		const nextTeam = team === "red" ? "black" : "red"

		// Insert new record
		const newRecord: any = {
			game_id: gameId,
			fen: newFen,
			team: nextTeam,
			time_stamp: Math.floor(Date.now() / 1000)
		}

		// Add capture piece if provided
		// Red team captures black pieces (uppercase), black team captures red pieces (lowercase)
		if (capturePiece) {
			newRecord.capture = team === "red" ? capturePiece.toUpperCase() : capturePiece.toLowerCase()
		}

		const insertResult = await collection.insertOne(newRecord)

		const responseData: any = {
			...newRecord,
			_id: insertResult.insertedId.toString()
		}

		// Emit move piece event to all clients in the room EXCEPT the requester
		try {
			const game = await prisma.game.findUnique({
				where: { id: gameId },
				select: { room_id: true }
			})

			const userId = req.auth?.userId ? parseInt(req.auth.userId, 10) : undefined
			if (game?.room_id) {
				emitMovePiece(game.room_id.toString(), responseData, userId)
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

