import { Response, Router } from "express"
import prisma from "../../prisma"
import { requireAuth, AuthenticatedRequest } from "../../middleware/auth"

const router = Router()

const UUID_REGEX =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * @swagger
 * /api/game/info/{id}:
 *   get:
 *     summary: Get game info by game ID
 *     tags:
 *       - Game
 *     security:
 *       - basicAuth: []
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Game fetched successfully
 *       400:
 *         description: Invalid game id
 *       404:
 *         description: Game not found
 *       500:
 *         description: Internal server error
 */
router.get("/game/info/:id", requireAuth(), async (req: AuthenticatedRequest, res: Response) => {
	const gameId = String(req.params.id || "").trim()

	if (!UUID_REGEX.test(gameId)) {
		res.status(400).json({
			success: false,
			message: "Game ID must be a valid UUID",
			status_code: 400,
			game: null
		})
		return
	}

	try {
		const game = await prisma.game.findUnique({
			where: { id: gameId },
			select: {
				id: true,
				name: true,
				status: true,
				red_first: true,
				bet_amount: true,
				created_at: true,
				updated_at: true
			}
		})

		if (!game) {
			res.status(404).json({
				success: false,
				message: "Game not found",
				status_code: 404,
				game: null
			})
			return
		}

		res.status(200).json({
			success: true,
			message: "Fetch game successfully",
			status_code: 200,
			game
		})
	} catch (err) {
		console.error("Fetch game info error:", err)
		res.status(500).json({
			success: false,
			message: "Internal server error",
			status_code: 500,
			game: null
		})
	}
})

export default router
