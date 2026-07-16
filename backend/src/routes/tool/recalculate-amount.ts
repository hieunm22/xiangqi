import { Request, Response, Router } from "express"
import { parseUserIdSpec, reconcileAmount } from "job/reconcile-amount"
import { requireApiKey } from "middleware/api-key"
import { UserIdSelection } from "types/job.type"

const router = Router()

/**
 * @swagger
 * /api/tool/recalculate-amount:
 *   post:
 *     summary: Recalculate cached total_amount from the amount ledgers
 *     description: >
 *       Recomputes total_amount = 200 + SUM(GameUser.amount) +
 *       SUM(UserAmountHistory.amount) and overrides any mismatch.
 *     tags:
 *       - Tool
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userIds:
 *                 type: string
 *                 description: >
 *                   Printer-page-range style selection of user IDs
 *                 example: "1, 4-6"
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
 *                   example: recalculate-amount.messages.success
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
 *       401:
 *         description: Invalid or missing API key
 *       404:
 *         description: Malformed userIds spec
 *       500:
 *         description: Internal server error
 */
router.post("/tool/recalculate-amount", requireApiKey(), async (req: Request, res: Response) => {
	try {
		const userIdsRaw = req.body?.userIds
		let selection: UserIdSelection | undefined

		if (userIdsRaw !== undefined && userIdsRaw !== null) {
			const parsed = typeof userIdsRaw === "string" ? parseUserIdSpec(userIdsRaw) : null
			if (parsed === null) {
				res.status(400).json({
					success: false,
					message: "recalculate-amount.messages.invalid-format",
					status_code: 400
				})
				return
			}
			selection = parsed
		}

		const result = await reconcileAmount({ autofix: true, selection })

		res.status(200).json({
			success: true,
			message: "recalculate-amount.messages.success",
			status_code: 200,
			data: result
		})
	} catch (err) {
		console.error("Recalculate amount error:", err)
		res.status(500).json({
			success: false,
			message: "recalculate-amount.messages.internal-server-error",
			status_code: 500
		})
	}
})

export default router
