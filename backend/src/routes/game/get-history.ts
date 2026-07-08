import { Response, Router } from "express"
import { requireAuth, AuthenticatedRequest } from "middleware/auth"
import { getGameHistoryCollection } from "common/mongodb"

const router = Router()

/**
 * @swagger
 * /api/game/movement-history:
 *   get:
 *     summary: Get game history by game id
 *     tags:
 *       - Game
 *     security:
 *       - basicAuth: []
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: gameId
 *         required: true
 *         schema:
 *           type: string
 *         description: Game identifier
 *     responses:
 *       200:
 *         description: Game history loaded successfully
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
 *                   example: get-game-history.messages.success
 *                 status_code:
 *                   type: integer
 *                   example: 200
 *                 data:
 *                   type: array
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
 *                       capture:
 *                         type: string
 *                         nullable: true
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized (missing, invalid, or expired token)
 *       500:
 *         description: Internal server error
 */
router.get("/game/movement-history", requireAuth(), async (req: AuthenticatedRequest, res: Response) => {
	const gameIdRaw = req.query.gameId
	const gameId = typeof gameIdRaw === "string" ? gameIdRaw.trim() : ""

	if (!gameId) {
		res.status(400).json({
			success: false,
			message: "get-game-history.messages.invalid-game-id",
			status_code: 400
		})
		return
	}

	try {
		const collection = await getGameHistoryCollection()
		const histories = await collection
			.find({
				$or: [{ gameId }, { game_id: gameId }]
			})
			.sort({ time_stamp: 1 })
			.toArray()

		const data = histories.map((item: any) => ({
			...item,
			_id: item?._id?.toString?.() ?? item?._id
		}))

		res.status(200).json({
			success: true,
			message: "get-game-history.messages.success",
			status_code: 200,
			data
		})
	} catch (err) {
		console.error("Get game history error:", err)
		res.status(500).json({
			success: false,
			message: "get-game-history.messages.internal-server-error",
			status_code: 500
		})
	}
})

export default router
