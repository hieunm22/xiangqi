import { Response, Router } from "express"
import prisma from "prisma"
import { getAvatarUrl } from "common/helper"
import { requireAuth, AuthenticatedRequest } from "middleware/auth"

const router = Router()

/**
 * @swagger
 * /api/game/player-history:
 *   get:
 *     summary: Get player's game history (finished games)
 *     tags:
 *       - Game
 *     security:
 *       - basicAuth: []
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Player history loaded successfully
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
 *                   example: player-history.messages.success
 *                 status_code:
 *                   type: integer
 *                   example: 200
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       game:
 *                         type: object
 *                         properties:
 *                           gameId:
 *                             type: string
 *                           ends_at:
 *                             type: string
 *                             format: date-time
 *                       users:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             id:
 *                               type: integer
 *                             display_name:
 *                               type: string
 *                             avatar_url:
 *                               type: string
 *                       amount:
 *                         type: integer
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized (missing, invalid, or expired token)
 *       500:
 *         description: Internal server error
 */
router.get("/game/player-history", requireAuth(), async (req: AuthenticatedRequest, res: Response) => {
	try {
		const userIdRaw = req.query.userId
		const userIdNum = typeof userIdRaw === "string" ? parseInt(userIdRaw, 10) : NaN
		const userId = !isNaN(userIdNum) && userIdNum > 0 ? BigInt(userIdNum) : null

		if (!userId) {
			res.status(400).json({
				success: false,
				message: "player-history.messages.invalid-user-id",
				status_code: 400
			})
			return
		}

		// Step 1: Get all games for this user
		const gameUsers = await prisma.gameUser.findMany({
			where: {
				user_id: userId,
				amount: { not: null }
			},
			select: {
				game_id: true,
				amount: true
			}
		})

		if (!gameUsers || gameUsers.length === 0) {
			res.status(200).json({
				success: true,
				message: "player-history.messages.success",
				status_code: 200,
				data: []
			})
			return
		}

		const gameIds = gameUsers.map(gu => gu.game_id)

		// Step 2: Filter games by status = 2 (finished)
		const finishedGames = await prisma.game.findMany({
			where: {
				id: { in: gameIds },
				status: 2
			},
			orderBy: {
				ends_at: "desc"
			},
			select: {
				id: true,
				ends_at: true
			}
		})

		if (!finishedGames || finishedGames.length === 0) {
			res.status(200).json({
				success: true,
				message: "player-history.messages.success",
				status_code: 200,
				data: []
			})
			return
		}

		const finishedGameIds = finishedGames.map(g => g.id)

		// Step 3: Get all game_users records for finished games
		const allGameUsers = await prisma.gameUser.findMany({
			where: {
				game_id: { in: finishedGameIds }
			},
			orderBy: [
				{
					games: {
						ends_at: "desc"
					}
				}
			],
			select: {
				game_id: true,
				user_id: true,
				amount: true,
				team: true,
				games: {
					select: {
						ends_at: true
					}
				},
				users: {
					select: {
						id: true,
						display_name: true,
						avatar_seq: true
					}
				}
			}
		})

		// Group by game_id
		const gameHistoryMap = new Map<string, any>()
		for (const gameUser of allGameUsers) {
			const gameId = gameUser.game_id
			if (!gameHistoryMap.has(gameId)) {
				gameHistoryMap.set(gameId, {
					game: {
						gameId: gameId,
						ends_at: gameUser.games.ends_at
					},
					users: [],
					amount: 0
				})
			}

			const gameHistory = gameHistoryMap.get(gameId)
			const avatarUrl = getAvatarUrl(gameUser.users.id, gameUser.users.avatar_seq)
			gameHistory.users.push({
				id: Number(gameUser.users.id),
				display_name: gameUser.users.display_name,
				avatar_url: avatarUrl,
				team: gameUser.team ?? null
			})

			// Use amount from current user's game_user record
			if (gameUser.user_id === userId) {
				gameHistory.amount = gameUser.amount
			}
		}

		const data = Array.from(gameHistoryMap.values())

		res.status(200).json({
			success: true,
			message: "player-history.messages.success",
			status_code: 200,
			data
		})
	} catch (err) {
		console.error("Get player history error:", err)
		res.status(500).json({
			success: false,
			message: "player-history.messages.internal-server-error",
			status_code: 500
		})
	}
})

export default router
