import { Response, Router } from "express"
import prisma from "../../prisma"
import { requireAuth, AuthenticatedRequest } from "../../middleware/auth"

const router = Router()

/**
 * @swagger
 * /api/tool/sequence:
 *   post:
 *     summary: Resync sequence for a table
 *     tags:
 *       - Tool
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - tablename
 *             properties:
 *               tablename:
 *                 type: string
 *                 description: Name of the table to resync sequence (e.g., rooms, users)
 *     responses:
 *       200:
 *         description: Sequence resynced successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 status_code:
 *                   type: integer
 *       400:
 *         description: Invalid request body
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.post(
	"/tool/sequence",
	requireAuth(),
	async (req: AuthenticatedRequest, res: Response) => {
		const { tablename } = req.body

		// Validate tablename
		if (!tablename || typeof tablename !== "string" || tablename.trim() === "") {
			res.status(400).json({
				success: false,
				message: "Table name (tablename) is required and must not be empty",
				status_code: 400
			})
			return
		}

		// Validate table name format (alphanumeric and underscore only)
		if (!/^[a-zA-Z0-9_]+$/.test(tablename)) {
			res.status(400).json({
				success: false,
				message: "Table name must contain only alphanumeric characters and underscores",
				status_code: 400
			})
			return
		}

		try {
			// Execute the sequence resync SQL
			// Note: Using string interpolation is safe here because we validate the table name above
			await prisma.$executeRawUnsafe(`
				SELECT setval(
					pg_get_serial_sequence('"game"."${tablename}"', 'id'),
					COALESCE((SELECT MAX(id) FROM "game"."${tablename}"), 0) + 1,
					false
				)
			`)

			res.status(200).json({
				success: true,
				message: `Sequence resynced successfully for table '${tablename}'`,
				status_code: 200
			})
		} catch (err) {
			console.error("Error resyncing sequence:", err)
			res.status(500).json({
				success: false,
				message: "Internal server error while resyncing sequence",
				status_code: 500
			})
		}
	}
)

export default router
