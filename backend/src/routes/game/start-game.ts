import { Response, Router } from "express"
import prisma from "prisma"
import { INITIAL_FEN_BLACK_BOTTOM, INITIAL_FEN_BLACK_TOP } from "common/constant"
import { getGameHistoryCollection } from "common/mongodb"
import { requireAuth, AuthenticatedRequest } from "middleware/auth"
import { RoomStatus, StartGameRequest } from "types/room.type"

const router = Router()

/**
 * @swagger
 * /api/room/start:
 *   post:
 *     summary: Start a game in a room
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
 *               - roomId
 *             properties:
 *               roomId:
 *                 type: integer
 *                 format: int64
 *     responses:
 *       201:
 *         description: Game started successfully
 *       400:
 *         description: Invalid request body
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Room not found
 *       500:
 *         description: Internal server error
 */
router.post("/room/start", requireAuth(), async (req: AuthenticatedRequest, res: Response) => {
	const { id } = req.body as StartGameRequest

	if (!Number.isInteger(id) || id <= 0) {
		res.status(400).json({
			success: false,
			message: "start-game.messages.invalid-room-id",
			status_code: 400
		})
		return
	}

	try {
		const roomIdBigInt = BigInt(id)

		const { game, room } = await prisma.$transaction(async tx => {
			const gameDelegate = (tx as any).game
			const updatedRoom = await tx.room.update({
				where: {
					id: roomIdBigInt
				},
				data: {
					status: RoomStatus.Playing
				},
				select: {
					id: true,
					status: true,
					red_first: true
				}
			})

			const createdGame = await gameDelegate.create({
				data: {
					status: 1,
					room_id: roomIdBigInt
				},
				select: {
					id: true,
					status: true,
					room_id: true
				}
			})

			return {
				game: createdGame,
				room: updatedRoom
			}
		})

		const collection = await getGameHistoryCollection()
		const initialFen = room.red_first ? INITIAL_FEN_BLACK_TOP : INITIAL_FEN_BLACK_BOTTOM
		const startRecord = {
			game_id: game.id,
			team: room.red_first ? "red" : "black",
			fen: initialFen,
			time_stamp: ~~(new Date().getTime() / 1000)
		}
		await collection.insertOne(startRecord)

		res.status(201).json({
			success: true,
			message: "start-game.messages.success",
			status_code: 201,
			data: {
				game: {
					id: game.id,
					status: game.status,
					room_id: Number(game.room_id)
				},
				room: {
					id: Number(room.id),
					status: room.status
				}
			}
		})
	} catch (err: any) {
		if (err?.code === "P2025") {
			res.status(404).json({
				success: false,
				message: "start-game.messages.room-not-found",
				status_code: 404
			})
			return
		}

		console.error("Start game error:", err)
		res.status(500).json({
			success: false,
			message: "start-game.messages.internal-server-error",
			status_code: 500
		})
	}
})

export default router

