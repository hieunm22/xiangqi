import { Response, Router } from "express"
import prisma from "prisma"
import { requireAuth, AuthenticatedRequest } from "middleware/auth"

const router = Router()

const MIN_SELECTED_TAB = 0
const MAX_SELECTED_TAB = 2

const normalizeSelectedTab = (value: number): number =>
	value >= MIN_SELECTED_TAB && value <= MAX_SELECTED_TAB ? value : MIN_SELECTED_TAB

/**
 * @swagger
 * /api/user/selected-tab:
 *   get:
 *     summary: Get the authenticated user's last-selected /extra-money tab index
 *     tags:
 *       - User
 *     security:
 *       - basicAuth: []
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: The selected tab index, clamped to the valid range (out-of-range reads as 0)
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
 *                   example: Success
 *                 status_code:
 *                   type: integer
 *                   example: 200
 *                 data:
 *                   type: object
 *                   properties:
 *                     selected_tab:
 *                       type: integer
 *                       description: The last-selected tab index (0..2)
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
router.get("/user/selected-tab", requireAuth(), async (req: AuthenticatedRequest, res: Response) => {
	try {
		const userId = req.auth?.userId

		if (!userId) {
			res.status(401).json({
				success: false,
				message: "Unauthorized",
				status_code: 401
			})
			return
		}

		const user = await prisma.user.findUnique({
			where: { id: BigInt(userId) },
			select: { selected_tab: true }
		})

		if (!user) {
			res.status(404).json({
				success: false,
				message: "User not found",
				status_code: 404
			})
			return
		}

		res.status(200).json({
			success: true,
			message: "Success",
			status_code: 200,
			data: {
				selected_tab: normalizeSelectedTab(user.selected_tab)
			}
		})
	} catch (error) {
		console.error("Get selected tab error:", error)
		res.status(500).json({
			success: false,
			message: "Internal server error",
			status_code: 500
		})
	}
})

/**
 * @swagger
 * /api/user/selected-tab:
 *   patch:
 *     summary: Persist the authenticated user's selected /extra-money tab index
 *     tags:
 *       - User
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
 *               - tab
 *             properties:
 *               tab:
 *                 type: integer
 *                 description: The tab index to persist (0..2)
 *                 example: 2
 *     responses:
 *       200:
 *         description: The persisted tab index
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
 *                   example: Success
 *                 status_code:
 *                   type: integer
 *                   example: 200
 *                 data:
 *                   type: object
 *                   properties:
 *                     selected_tab:
 *                       type: integer
 *       400:
 *         description: Invalid or out-of-range tab parameter
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.patch("/user/selected-tab", requireAuth(), async (req: AuthenticatedRequest, res: Response) => {
	try {
		const { tab } = req.body
		const userId = req.auth?.userId

		if (!userId) {
			res.status(401).json({
				success: false,
				message: "Unauthorized",
				status_code: 401
			})
			return
		}

		const tabNumber = Number(tab)
		if (!Number.isInteger(tabNumber) || tabNumber < MIN_SELECTED_TAB || tabNumber > MAX_SELECTED_TAB) {
			res.status(400).json({
				success: false,
				message: "Tab must be an integer within the valid range",
				status_code: 400
			})
			return
		}

		await prisma.user.update({
			where: { id: BigInt(userId) },
			data: { selected_tab: tabNumber }
		})

		res.status(200).json({
			success: true,
			message: "Success",
			status_code: 200,
			data: {
				selected_tab: tabNumber
			}
		})
	} catch (error) {
		console.error("Update selected tab error:", error)
		res.status(500).json({
			success: false,
			message: "Internal server error",
			status_code: 500
		})
	}
})

export default router
