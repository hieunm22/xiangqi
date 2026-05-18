import { Request, Response, Router } from "express"
import prisma from "prisma"

const router = Router()

/**
 * @swagger
 * /api/auth/user:
 *   get:
 *     summary: Get a user's information by ID (excluding password)
 *     tags:
 *       - Auth
 *     parameters:
 *       - in: query
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The user ID
 *     responses:
 *       200:
 *         description: User information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: number
 *                     user_name:
 *                       type: string
 *                     email:
 *                       type: string
 *                     display_name:
 *                       type: string
 *                     gender:
 *                       type: boolean
 *                     avatar_seq:
 *                       type: number
 *                 status_code:
 *                   type: number
 *       400:
 *         description: Invalid user ID
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */
router.get("/auth/user", async (req: Request, res: Response) => {
	const id = Number(req.query.id)

	if (!Number.isInteger(id) || id <= 0) {
		res.status(400).json({
			success: false,
			message: "Invalid user ID",
			status_code: 400
		})
		return
	}

	try {
		const user = await prisma.user.findUnique({
			where: { id },
			select: {
				id: true,
				user_name: true,
				email: true,
				display_name: true,
				gender: true,
				avatar_seq: true
			}
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
			status_code: 200,
			data: { ...user, id: Number(user.id) }
		})
	} catch (error) {
		console.error("Get user error:", error)
		res.status(500).json({
			success: false,
			message: "Internal server error",
			status_code: 500
		})
	}
})

export default router

