import { Response, Router } from "express"
import prisma from "prisma"
import { requireAuth, AuthenticatedRequest } from "middleware/auth"
import { getGameHistoryCollection } from "common/mongodb"
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
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
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
			time_stamp: Math.floor(Date.now() / 1000)
		})

		await prisma.$transaction([
			prisma.game.update({
				where: {
					id: normalizedGameId
				},
				data: {
					ends_at: new Date(),
					status: 2,
					winner_id: null
				}
			}),
			prisma.room.update({
				where: {
					id: game.room_id
				},
				data: {
					updated_at: new Date(),
					status: 1
				}
			})
		])

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
