import { Request, Response, Router } from "express"
import prisma from "../../prisma"
import { requireAuth, AuthenticatedRequest } from "../../middleware/auth"

const router = Router()

/**
 * @swagger
 * /api/game/fetch-games:
 *   get:
 *     summary: Fetch all games
 *     tags:
 *       - Game
 *     security:
 *       - basicAuth: []
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         required: false
 *         schema:
 *           type: integer
 *         description: Filter by game status
 *     responses:
 *       200:
 *         description: Games fetched successfully
 *       400:
 *         description: Invalid status query parameter
 *       500:
 *         description: Internal server error
 */
router.get("/game/fetch-games", requireAuth(), async (req: AuthenticatedRequest, res: Response) => {
	const statusQuery = req.query.status

	if (
		statusQuery !== undefined &&
		(Number.isNaN(Number(statusQuery)) || !Number.isInteger(Number(statusQuery)))
	) {
		res.status(400).json({
			success: false,
			message: "Query parameter 'status' must be an integer",
			status_code: 400,
			games: []
		})
		return
	}

	const status = statusQuery !== undefined ? Number(statusQuery) : undefined

	try {
		const games = await prisma.game.findMany({
			...(status !== undefined && { where: { status } }),
			orderBy: { created_at: "desc" },
			select: {
				id: true,
				name: true,
				status: true,
				red_first: true,
				bet_amount: true,
				created_at: true,
				updated_at: true,
				game_users: {
					orderBy: {
						joined_at: "asc"
					},
					select: {
						users: {
							select: {
								id: true,
								display_name: true,
								avatar_seq: true
							}
						}
					}
				}
			}
		})

		const formattedGames = games.map(game => {
			const { game_users, ...rest } = game
			return {
				...rest,
				users: game_users.map(gu => ({
					...gu.users,
					id: Number(gu.users.id),
					avatar_seq: Number(gu.users.avatar_seq),
					avatar_url:
						Number(gu.users.avatar_seq) === 0
							? `/images/${Number(gu.users.id)}.jpg`
							: `/images/${Number(gu.users.id)}_${Number(gu.users.avatar_seq)}.jpg`
				}))
			}
		})

		res.status(200).json({
			success: true,
			message: "Fetch games successfully",
			status_code: 200,
			games: formattedGames
		})
	} catch (err) {
		console.error("Fetch games error:", err)
		res.status(500).json({
			success: false,
			message: "Internal server error",
			status_code: 500,
			games: []
		})
	}
})

export default router
