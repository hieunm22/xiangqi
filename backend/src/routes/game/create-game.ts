import { Request, Response, Router } from "express"
import prisma from "../../prisma"
import { requireAuth, AuthenticatedRequest } from "../../middleware/auth"

const router = Router()

export interface CreateGameRequest {
	tableName: string
	teamName: string
	redFirst: boolean
	betAmount: number
}

const ACCEPTABLE_BET_AMOUNTS = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000]

/**
 * @swagger
 * /api/game/create-game:
 *   post:
 *     summary: Create a new game
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
 *               - tableName
 *               - teamName
 *               - betAmount
 *             properties:
 *               tableName:
 *                 type: string
 *                 description: Name of the game table
 *               teamName:
 *                 type: string
 *                 description: Team name for the current user
 *               redFirst:
 *                 type: boolean
 *                 description: Whether red moves first
 *                 default: true
 *               betAmount:
 *                 type: number
 *                 description: Bet amount for the game (valid values - 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000)
 *                 default: 10
 *                 enum: [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000]
 *     responses:
 *       201:
 *         description: Game created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 status_code:
 *                   type: integer
 *                 game:
 *                   type: object
 *       400:
 *         description: Invalid request body
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.post(
	"/game/create-game",
	requireAuth(),
	async (req: AuthenticatedRequest, res: Response) => {
		const { tableName, teamName, redFirst = true, betAmount = 10 } = req.body as CreateGameRequest
		const userId = req.auth?.userId

		// Validate game name
		if (!tableName || typeof tableName !== "string" || tableName.trim() === "") {
			res.status(400).json({
				success: false,
				message: "Game name (tableName) is required and must not be empty",
				status_code: 400
			})
			return
		}

		// Validate team name
		if (!teamName || typeof teamName !== "string" || (teamName !== "red" && teamName !== "black")) {
			res.status(400).json({
				success: false,
				message: "Team name must be either 'red' or 'black'",
				status_code: 400
			})
			return
		}

		// Validate redFirst
		if (typeof redFirst !== "boolean") {
			res.status(400).json({
				success: false,
				message: "Invalid request body: 'redFirst' must be a boolean",
				status_code: 400
			})
			return
		}

		// Validate bet amount
		if (betAmount === undefined || betAmount === null || !ACCEPTABLE_BET_AMOUNTS.includes(betAmount)) {
			res.status(400).json({
				success: false,
				message: `Bet amount is required. Acceptable values: ${ACCEPTABLE_BET_AMOUNTS.join(", ")}`,
				status_code: 400
			})
			return
		}

		if (typeof betAmount !== "number" || !ACCEPTABLE_BET_AMOUNTS.includes(betAmount)) {
			res.status(400).json({
				success: false,
				message: `Bet amount must be one of: ${ACCEPTABLE_BET_AMOUNTS.join(", ")}`,
				status_code: 400
			})
			return
		}

		try {
			const userIdBigInt = BigInt(userId!)

			// Remove existing game_users records for this user
			await prisma.gameUser.deleteMany({
				where: {
					user_id: userIdBigInt
				}
			})

			// Create game and game_user in a transaction
			const game = await prisma.game.create({
				data: {
					name: tableName,
					status: 1, // 1 = waiting for opponent
					red_first: redFirst,
					bet_amount: betAmount,
					game_users: {
						create: {
							user_id: userIdBigInt,
							team: teamName,
							joined_at: new Date()
						}
					}
				},
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
							},
							team: true
						}
					}
				}
			})

			// Format response
			const formattedGame = {
				...game,
				users: game.game_users.map((gu: any) => ({
					...gu.users,
					id: gu.users.id.toString(),
					team: gu.team,
					avatar_url:
						gu.users.avatar_seq === 0
							? `/images/${gu.users.id.toString()}.jpg`
							: `/images/${gu.users.id.toString()}_${gu.users.avatar_seq}.jpg`
				})),
				game_users: undefined
			}
			delete (formattedGame as any).game_users

			res.status(201).json({
				success: true,
				message: "Game created successfully",
				status_code: 201,
				game: formattedGame
			})
		} catch (err) {
			console.error("Error creating game:", err)
			res.status(500).json({
				success: false,
				message: "Internal server error while creating game",
				status_code: 500
			})
		}
	}
)

export default router
