import { Response, Router } from "express"
import prisma from "prisma"
import { getAvatarUrl } from "common/helper"
import { requireAuth, AuthenticatedRequest } from "middleware/auth"

const router = Router()

const normalizeString = (str: string): string => {
	return str
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLowerCase()
}

/**
 * @swagger
 * /api/user/search:
 *   get:
 *     summary: Search users by display name (supports searching without diacritical marks)
 *     tags:
 *       - User
 *     security:
 *       - basicAuth: []
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: query
 *         required: true
 *         schema:
 *           type: string
 *         description: The search text (case-insensitive, diacritical marks optional)
 *     responses:
 *       200:
 *         description: List of users matching the search query
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
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       display_name:
 *                         type: string
 *                       avatar_url:
 *                         type: string
 *       400:
 *         description: Missing or invalid search query
 *       500:
 *         description: Internal server error
 */
router.get("/user/search", requireAuth(), async (req: AuthenticatedRequest, res: Response) => {
	const query = String(req.query.query || "").trim()

	if (!query || query.length === 0) {
		res.status(400).json({
			success: false,
			message: "Search query is required",
			status_code: 400
		})
		return
	}

	if (query.length > 100) {
		res.status(400).json({
			success: false,
			message: "Search query is too long (max 100 characters)",
			status_code: 400
		})
		return
	}

	try {
		const normalizedQuery = normalizeString(query)

		const users = await prisma.user.findMany({
			select: {
				id: true,
				display_name: true,
				avatar_seq: true
			}
		})

		const filtered = users.filter(u =>
			normalizeString(u.display_name).includes(normalizedQuery) && Number(u.id) !== Number(req.auth?.userId) // Exclude the current user
		)

		const result = filtered.map(user => ({
			id: Number(user.id),
			display_name: user.display_name,
			avatar_url: getAvatarUrl(Number(user.id), user.avatar_seq)
		}))

		res.status(200).json({
			success: true,
			message: "Success",
			status_code: 200,
			data: result
		})
	} catch (error) {
		console.error("Search user error:", error)
		res.status(500).json({
			success: false,
			message: "Internal server error",
			status_code: 500
		})
	}
})

export default router

