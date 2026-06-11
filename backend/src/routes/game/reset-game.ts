import { Request, Response, Router } from "express"
import prisma from "prisma"
import { getGameHistoryCollection } from "common/mongodb"

const router = Router()

/**
 * @swagger
 * /api/tool/reset-game:
 *   post:
 *     summary: Reset game history by room id for testing
 *     tags:
 *       - Tool
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - room_id
 *             properties:
 *               room_id:
 *                 type: integer
 *                 description: Room identifier
 *     responses:
 *       200:
 *         description: Game history reset successfully
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
 *                   example: reset-game.messages.success
 *                 status_code:
 *                   type: integer
 *                   example: 200
 *                 data:
 *                   type: object
 *                   properties:
 *                     room_id:
 *                       type: integer
 *                     game_id:
 *                       type: string
 *                       nullable: true
 *                     kept_record_id:
 *                       type: string
 *                       nullable: true
 *                     deleted_count:
 *                       type: integer
 *       500:
 *         description: Internal server error
 */
router.post("/tool/reset-game", async (req: Request, res: Response) => {
	try {
		const roomIdRaw = req.body?.roomId
		const roomId = typeof roomIdRaw === "number" ? roomIdRaw : parseInt(roomIdRaw, 10)

		if (!Number.isInteger(roomId) || roomId <= 0) {
			res.status(200).json({
				success: true,
				message: "reset-game.messages.success",
				status_code: 200,
				data: {
					room_id: roomId,
					game_id: null,
					kept_record_id: null,
					deleted_count: 0
				}
			})
			return
		}

		const roomIdBigInt = BigInt(roomId)

		// Find game with status = 1 for the given room_id
		const game = await prisma.game.findFirst({
			where: {
				room_id: roomIdBigInt,
				status: 1
			},
			select: { id: true }
		})

		if (!game) {
			res.status(200).json({
				success: true,
				message: "reset-game.messages.success",
				status_code: 200,
				data: {
					room_id: roomId,
					game_id: null,
					kept_record_id: null,
					deleted_count: 0
				}
			})
			return
		}

		const gameId = game.id
		const collection = await getGameHistoryCollection()

		// Find first record of this game
		const firstRecord = await collection.findOne(
			{ $or: [{ game_id: gameId }, { gameId }] },
			{ sort: { _id: 1 } }
		)

		if (!firstRecord) {
			res.status(200).json({
				success: true,
				message: "reset-game.messages.success",
				status_code: 200,
				data: {
					room_id: roomId,
					game_id: gameId,
					kept_record_id: null,
					deleted_count: 0
				}
			})
			return
		}

		// Delete all records except the first one for this game
		const deleteResult = await collection.deleteMany({
			$or: [{ game_id: gameId }, { gameId }],
			_id: { $ne: firstRecord._id }
		})

		res.status(200).json({
			success: true,
			message: "reset-game.messages.success",
			status_code: 200,
			data: {
				room_id: roomId,
				game_id: gameId,
				kept_record_id: firstRecord._id?.toString?.() ?? null,
				deleted_count: deleteResult.deletedCount ?? 0
			}
		})
	} catch (err) {
		console.error("Reset game history error:", err)
		res.status(500).json({
			success: false,
			message: "reset-game.messages.internal-server-error",
			status_code: 500
		})
	}
})

export default router
