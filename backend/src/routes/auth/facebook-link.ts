import { Response, Router } from "express"
import prisma from "prisma"
import { verifyFacebookAccessToken } from "./_facebook"
import { requireAuth, AuthenticatedRequest } from "middleware/auth"
import { FacebookLinkRequest } from "types/auth.type"

const router = Router()

const FACEBOOK_PROVIDER = "facebook"

/**
 * @swagger
 * /api/auth/facebook-link:
 *   post:
 *     summary: Link a Facebook account to the authenticated user
 *     description: >
 *       Binds the verified Facebook identity to the current user. Because this
 *       happens inside an authenticated session, we trust the caller owns the
 *       account, so no email verification is needed. A Facebook account can be
 *       linked to at most one user, and a user can link at most one Facebook account.
 *     tags:
 *       - Auth
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - accessToken
 *             properties:
 *               accessToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Linked (or already linked to this user)
 *       400:
 *         description: Missing token
 *       401:
 *         description: Unauthorized or invalid Facebook token
 *       409:
 *         description: Facebook account already linked to another user, or user already has a linked Facebook account
 *       500:
 *         description: Internal server error
 *   delete:
 *     summary: Unlink the authenticated user's Facebook account
 *     tags:
 *       - Auth
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Unlinked (idempotent)
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.post("/auth/facebook-link", requireAuth(), async (req: AuthenticatedRequest, res: Response) => {
	const userId = Number(req.auth?.userId)
	const { accessToken } = req.body as FacebookLinkRequest

	if (!accessToken?.trim()) {
		res.status(400).json({
			success: false,
			message: "facebook-link.messages.missing-token",
			status_code: 400
		})
		return
	}

	let profile
	try {
		profile = await verifyFacebookAccessToken(accessToken)
	} catch (err) {
		console.error("Facebook token verification failed:", err)
		res.status(401).json({
			success: false,
			message: "facebook-link.messages.invalid-token",
			status_code: 401
		})
		return
	}

	try {
		if (!profile) {
			res.status(401).json({
				success: false,
				message: "facebook-link.messages.invalid-token",
				status_code: 401
			})
			return
		}

		// Is this Facebook account already bound somewhere?
		const existing = await prisma.userIdentity.findUnique({
			where: {
				provider_provider_user_id: {
					provider: FACEBOOK_PROVIDER,
					provider_user_id: profile.id
				}
			},
			select: { user_id: true }
		})

		if (existing) {
			if (Number(existing.user_id) === userId) {
				res.status(200).json({
					success: true,
					message: "facebook-link.messages.already-linked",
					status_code: 200
				})
				return
			}

			res.status(409).json({
				success: false,
				message: "facebook-link.messages.linked-to-other",
				status_code: 409
			})
			return
		}

		// One Facebook account per user: reject if they already linked a different one.
		const ownFacebook = await prisma.userIdentity.findFirst({
			where: { user_id: userId, provider: FACEBOOK_PROVIDER },
			select: { id: true }
		})

		if (ownFacebook) {
			res.status(409).json({
				success: false,
				message: "facebook-link.messages.already-has-facebook",
				status_code: 409
			})
			return
		}

		await prisma.userIdentity.create({
			data: {
				user_id: userId,
				provider: FACEBOOK_PROVIDER,
				provider_user_id: profile.id,
				email: profile.email?.trim().toLowerCase() ?? null
			}
		})

		res.status(200).json({
			success: true,
			message: "facebook-link.messages.linked",
			status_code: 200
		})
	} catch (err) {
		console.error("Facebook link error:", err)
		res.status(500).json({
			success: false,
			message: "facebook-link.messages.internal-server-error",
			status_code: 500
		})
	}
})

router.delete("/auth/facebook-link", requireAuth(), async (req: AuthenticatedRequest, res: Response) => {
	const userId = Number(req.auth?.userId)

	try {
		await prisma.userIdentity.deleteMany({
			where: { user_id: userId, provider: FACEBOOK_PROVIDER }
		})

		res.status(200).json({
			success: true,
			message: "facebook-link.messages.unlinked",
			status_code: 200
		})
	} catch (err) {
		console.error("Facebook unlink error:", err)
		res.status(500).json({
			success: false,
			message: "facebook-link.messages.internal-server-error",
			status_code: 500
		})
	}
})

export default router
