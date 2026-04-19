import { Request, Response, Router } from "express"

const router = Router()

/**
 * @swagger
 * /api/health:
 *   get:
 *     summary: Check API status
 *     tags:
 *       - Health
 *     responses:
 *       200:
 *         description: API is healthy
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
 *                   example: Chess API is running
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 */
router.get("/health", (_req: Request, res: Response) => {
	res.status(200).json({
		success: true,
		message: "Chess API is running",
		timestamp: new Date().toISOString()
	})
})

export default router
