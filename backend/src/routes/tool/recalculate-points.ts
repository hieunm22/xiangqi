import { Request, Response, Router } from "express"
import { reconcilePoints } from "job/reconcile-points"

const router = Router()

/**
 * @swagger
 * /api/tool/recalculate-points:
 *   post:
 *     summary: Recalculate cached total_amount from the GameUser ledger
 *     description: >
 *       Recomputes total_amount = 200 + SUM(GameUser.point) and override any
 *       mismatch.
 *     tags:
 *       - Tool
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userIds:
 *                 type: array
 *                 items:
 *                   type: integer
 *                   format: int64
 *                 description: List of user IDs to reconcile; omit to reconcile all users
 *                 example: [1, 2, 3]
 *     responses:
 *       200:
 *         description: Recalculation completed
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
 *                   example: recalculate-points.messages.success
 *                 status_code:
 *                   type: integer
 *                   example: 200
 *                 data:
 *                   type: object
 *                   properties:
 *                     checked:
 *                       type: integer
 *                     fixed:
 *                       type: integer
 *                     mismatches:
 *                       type: array
 *                       items:
 *                         type: object
 *       400:
 *         description: Invalid user ids
 *       500:
 *         description: Internal server error
 */
router.post("/tool/recalculate-points", async (req: Request, res: Response) => {
	try {
		const userIdsRaw = req.body?.userIds
		let userIds: bigint[] | undefined

		if (userIdsRaw !== undefined && userIdsRaw !== null) {
			if (!Array.isArray(userIdsRaw)) {
				res.status(400).json({
					success: false,
					message: "recalculate-points.messages.invalid-user-id",
					status_code: 400
				})
				return
			}

			userIds = []
			for (const id of userIdsRaw) {
				const parsed = typeof id === "number" ? id : parseInt(id, 10)
				if (!Number.isInteger(parsed) || parsed <= 0) {
					res.status(400).json({
						success: false,
						message: "recalculate-points.messages.invalid-user-id",
						status_code: 400
					})
					return
				}
				userIds.push(BigInt(parsed))
			}
		}

		const result = await reconcilePoints({ autofix: true, userIds })

		res.status(200).json({
			success: true,
			message: "recalculate-points.messages.success",
			status_code: 200,
			data: result
		})
	} catch (err) {
		console.error("Recalculate points error:", err)
		res.status(500).json({
			success: false,
			message: "recalculate-points.messages.internal-server-error",
			status_code: 500
		})
	}
})

export default router
