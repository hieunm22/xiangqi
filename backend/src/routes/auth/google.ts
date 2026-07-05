import { Request, Response, Router } from "express"
import { OAuth2Client, TokenPayload } from "google-auth-library"
import prisma from "prisma"
import { establishUserSession } from "./_session"
import { GoogleLoginRequest, LoginSuccessResponse } from "types/auth.type"

const router = Router()

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID
const GOOGLE_PROVIDER = "google"
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID)

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
 * /api/auth/google:
 *   post:
 *     summary: Authenticate an existing user with a Google ID token
 *     description: >
 *       Login only. Verifies the Google ID token, requires a verified email,
 *       then resolves the account by the linked Google identity or by the
 *       verified email
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
 *               - credential
 *             properties:
 *               credential:
 *                 type: string
 *                 description: Google ID token returned by Google Identity Services
 *               timezoneOffset:
 *                 type: number
 *               deviceName:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *       400:
 *         description: Missing credential, unverified email, or no matching account
 *       401:
 *         description: Invalid Google token
 *       500:
 *         description: Internal server error
 */
router.post("/auth/google", async (req: Request, res: Response) => {
	const { credential, timezoneOffset, deviceName } = req.body as GoogleLoginRequest

	if (!credential?.trim()) {
		res.status(400).json(failure(400, "google-login.messages.missing-credential"))
		return
	}

	let payload: TokenPayload | undefined
	try {
		const ticket = await googleClient.verifyIdToken({
			idToken: credential,
			audience: GOOGLE_CLIENT_ID
		})
		payload = ticket.getPayload()
	} catch (err) {
		console.error("Google token verification failed:", err)
		res.status(401).json(failure(401, "google-login.messages.invalid-token"))
		return
	}

	try {
		if (!payload?.sub || !payload.email) {
			res.status(400).json(failure(400, "google-login.messages.invalid-token"))
			return
		}

		// Login only trusts the account resolved from a verified Google email.
		if (payload.email_verified !== true) {
			res.status(400).json(failure(400, "google-login.messages.email-not-verified"))
			return
		}

		const providerUserId = payload.sub
		const email = payload.email.trim().toLowerCase()

		// 1. Already linked -> log that user in.
		const identity = await prisma.userIdentity.findUnique({
			where: {
				provider_provider_user_id: {
					provider: GOOGLE_PROVIDER,
					provider_user_id: providerUserId
				}
			},
			select: { user_id: true }
		})

		let userId: number
		if (identity) {
			userId = Number(identity.user_id)
		} else {
			// 2. Not linked yet: bind to an existing account matched by verified email.
			const user = await prisma.user.findUnique({
				where: { email },
				select: { id: true }
			})

			// 3. No account for this email. Login only: never create one here.
			// Return a generic failure so we don't leak which emails are registered.
			if (!user) {
				res.status(400).json(failure(400, "google-login.messages.failed"))
				return
			}

			userId = Number(user.id)
			await prisma.userIdentity.create({
				data: {
					user_id: user.id,
					provider: GOOGLE_PROVIDER,
					provider_user_id: providerUserId,
					email
				}
			})
		}

		const response = await establishUserSession(res, {
			userId,
			timezoneOffset,
			deviceName
		})

		res.status(200).json(response)
	} catch (err) {
		console.error("Google login error:", err)
		res.status(500).json(failure(500, "google-login.messages.internal-server-error"))
	}
})

export default router
