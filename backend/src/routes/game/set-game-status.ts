import { Response, Router } from "express"
import prisma from "../../prisma"
import { requireAuth, AuthenticatedRequest } from "../../middleware/auth"

const router = Router()

interface SetGameStatusRequest {
	id: string
	status: number
}

const VALID_STATUSES = [1, 2]
const UUID_REGEX =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * @swagger
 * /api/game/status:
 *   patch:
 *     summary: Update game status
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
 *               - status
 *             properties:
 *               id:
 *                 type: string
 *                 format: uuid
 *               status:
 *                 type: integer
 *                 enum: [1, 2]
 */
const handleSetGameStatus = async (req: AuthenticatedRequest, res: Response) => {
	const { id, status } = req.body as SetGameStatusRequest

	if (!id || typeof id !== "string" || !UUID_REGEX.test(id)) {
		res.status(400).json({
			success: false,
			message: "Field 'id' is required and must be a valid UUID",
			status_code: 400
		})
		return
	}

	if (!Number.isInteger(status) || !VALID_STATUSES.includes(status)) {
		res.status(400).json({
			success: false,
			message: "Field 'status' must be either 1 or 2",
			status_code: 400
		})
		return
	}

	try {
		const game = await prisma.game.update({
			where: { id },
			data: {
				status
			},
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

		res.status(200).json({
			success: true,
			message: "Set game status successfully",
			status_code: 200,
			game
		})
	} catch (err: any) {
		if (err?.code === "P2025") {
			res.status(404).json({
				success: false,
				message: "Game not found",
				status_code: 404
			})
			return
		}

		console.error("Set game status error:", err)
		res.status(500).json({
			success: false,
			message: "Internal server error",
			status_code: 500
		})
	}
}

router.patch("/game/status", requireAuth(), handleSetGameStatus)
router.put("/game/status", requireAuth(), handleSetGameStatus)

export default router
