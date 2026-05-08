import { Response, Router } from "express"
import prisma from "../../prisma"
import { requireAuth, AuthenticatedRequest } from "../../middleware/auth"

const router = Router()

interface LeaveGameRequest {
	id: string
}

const UUID_REGEX =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * @swagger
 * /api/game/leave:
 *   delete:
 *     summary: Leave a game table
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
router.delete("/game/leave", requireAuth(), async (req: AuthenticatedRequest, res: Response) => {
	const { id } = req.body as LeaveGameRequest
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
		const deleted = await prisma.gameUser.deleteMany({
			where: {
				game_id: id,
				user_id: BigInt(userId)
			}
		})

		if (deleted.count === 0) {
			res.status(404).json({
				success: false,
				message: "Player is not in this game",
				status_code: 404
			})
			return
		}

		res.status(200).json({
			success: true,
			message: "Leave game successfully",
			status_code: 200
		})
	} catch (err) {
		console.error("Leave game error:", err)
		res.status(500).json({
			success: false,
			message: "Internal server error",
			status_code: 500
		})
	}
})

export default router
