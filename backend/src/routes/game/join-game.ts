import { Response, Router } from "express"
import prisma from "../../prisma"
import { requireAuth, AuthenticatedRequest } from "../../middleware/auth"

const router = Router()

interface JoinGameRequest {
	id: string
}

const UUID_REGEX =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * @swagger
 * /api/game/join:
 *   post:
 *     summary: Join a game table
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
 *               - id
 *             properties:
 *               id:
 *                 type: string
 *                 format: uuid
 */
router.post("/game/join", requireAuth(), async (req: AuthenticatedRequest, res: Response) => {
	const { id } = req.body as JoinGameRequest
	const userId = req.auth?.userId

	if (!userId) {
		res.status(401).json({
			success: false,
			message: "Unauthorized",
			status_code: 401
		})
		return
	}

	if (!id || typeof id !== "string" || !UUID_REGEX.test(id)) {
		res.status(400).json({
			success: false,
			message: "Field 'id' is required and must be a valid UUID",
			status_code: 400
		})
		return
	}

	try {
		// Check if game exists
		const game = await prisma.game.findUnique({
			where: { id }
		})

		if (!game) {
			res.status(404).json({
				success: false,
				message: "Game not found",
				status_code: 404
			})
			return
		}

		const userIdBigInt = BigInt(userId)
		const now = new Date()

		// Remove user from all other games to ensure single-game participation
		await prisma.gameUser.deleteMany({
			where: {
				user_id: userIdBigInt,
				game_id: {
					not: id
				}
			}
		})

		const existingGameUser = await prisma.gameUser.findUnique({
			where: {
				game_id_user_id: {
					game_id: id,
					user_id: userIdBigInt
				}
			}
		})

		if (existingGameUser) {
			// User is already in this game: refresh join timestamp
			await prisma.gameUser.update({
				where: {
					game_id_user_id: {
						game_id: id,
						user_id: userIdBigInt
					}
				},
				data: {
					joined_at: now
				}
			})
		} else {
			// User is joining a new game: assign team by join order.
			// - 2nd user: opposite of 1st user's team
			// - 3rd+ user: null team (spectator)
			const existingMembers = await prisma.gameUser.findMany({
				where: {
					game_id: id
				},
				select: {
					team: true
				},
				orderBy: {
					joined_at: "asc"
				}
			})

			let assignedTeam: string | null = null
			if (existingMembers.length === 1) {
				const firstTeam = existingMembers[0].team
				assignedTeam = firstTeam === "red" ? "black" : "red"
			}

			await prisma.gameUser.create({
				data: {
					game_id: id,
					user_id: userIdBigInt,
					team: assignedTeam,
					joined_at: now
				}
			})
		}

		// Fetch all users joined in this game, ordered by joined_at
		const gameUsers = await prisma.gameUser.findMany({
			where: {
				game_id: id
			},
			select: {
				joined_at: true,
				team: true,
				users: {
					select: {
						id: true,
						display_name: true,
						avatar_seq: true
					}
				}
			},
			orderBy: {
				joined_at: "asc"
			}
		})

		const formattedUsers = gameUsers.map(gameUser => ({
			id: Number(gameUser.users.id),
			display_name: gameUser.users.display_name,
			avatar_seq: Number(gameUser.users.avatar_seq),
			avatar_url:
				Number(gameUser.users.avatar_seq) === 0
					? `/images/${Number(gameUser.users.id)}.jpg`
					: `/images/${Number(gameUser.users.id)}_${Number(gameUser.users.avatar_seq)}.jpg`,
			team: gameUser.team,
			joined_at: gameUser.joined_at
		}))

		res.status(201).json({
			success: true,
			message: "Successfully joined the game",
			status_code: 201,
			data: formattedUsers
		})
	} catch (error) {
		console.error("Error joining game:", error)
		res.status(500).json({
			success: false,
			message: "Internal server error",
			status_code: 500
		})
	}
})

export default router
