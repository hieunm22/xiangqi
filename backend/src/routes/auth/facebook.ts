import { Request, Response, Router } from "express"
import prisma from "prisma"
import { establishUserSession } from "./_session"
import { verifyFacebookAccessToken } from "./_facebook"
import { FacebookLoginRequest, LoginSuccessResponse } from "types/auth.type"

const router = Router()

const FACEBOOK_PROVIDER = "facebook"

const failure = (status_code: number, message: string): LoginSuccessResponse => ({
	success: false,
	message,
	status_code,
	access_token: "",
	refresh_token: "",
	token_type: "Bearer"
})

/**
 * @swagger
 * /api/auth/facebook:
 *   post:
 *     summary: Authenticate a user whose Facebook account is already linked
 *     description: >
 *       Login only. Verifies the Facebook access token, then resolves the account
 *       strictly by the linked Facebook identity (never by email, since Facebook
 *       exposes no verifiable email). An account must be linked beforehand via
 *       POST /api/auth/facebook/link while authenticated.
 *     tags:
 *       - Auth
 *     security: []
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
 *                 description: Facebook user access token from the Facebook JS SDK
 *               timezoneOffset:
 *                 type: number
 *               deviceName:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *       400:
 *         description: Missing token or Facebook account not linked to any user
 *       401:
 *         description: Invalid Facebook token
 *       500:
 *         description: Internal server error
 */
router.post("/auth/facebook", async (req: Request, res: Response) => {
	const { accessToken, timezoneOffset, deviceName } = req.body as FacebookLoginRequest

	if (!accessToken?.trim()) {
		res.status(400).json(failure(400, "facebook-login.messages.missing-token"))
		return
	}

	let profile
	try {
		profile = await verifyFacebookAccessToken(accessToken)
	} catch (err) {
		console.error("Facebook token verification failed:", err)
		res.status(401).json(failure(401, "facebook-login.messages.invalid-token"))
		return
	}

	try {
		if (!profile) {
			res.status(401).json(failure(401, "facebook-login.messages.invalid-token"))
			return
		}

		// Facebook is resolved ONLY by the stable, unforgeable provider id that was
		// bound during an authenticated link step — never by email.
		const identity = await prisma.userIdentity.findUnique({
			where: {
				provider_provider_user_id: {
					provider: FACEBOOK_PROVIDER,
					provider_user_id: profile.id
				}
			},
			select: { user_id: true }
		})

		if (!identity) {
			res.status(400).json(failure(400, "facebook-login.messages.not-linked"))
			return
		}

		const response = await establishUserSession(res, {
			userId: Number(identity.user_id),
			timezoneOffset,
			deviceName
		})

		res.status(200).json(response)
	} catch (err) {
		console.error("Facebook login error:", err)
		res.status(500).json(failure(500, "facebook-login.messages.internal-server-error"))
	}
})

export default router
