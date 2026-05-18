import { Response, Router } from "express"
import { requireAuth, AuthenticatedRequest } from "middleware/auth"
import { getGameHistoryCollection } from "common/mongodb"

const router = Router()

/**
 * @swagger
 * /api/game/history:
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
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get("/game/history", requireAuth(), async (req: AuthenticatedRequest, res: Response) => {
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
