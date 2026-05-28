import { Response, Router } from "express"
import jwt from "jsonwebtoken"
import { requireAuth, AuthenticatedRequest } from "middleware/auth"

const router = Router()

const JWT_SECRET = process.env.JWT_SECRET!
const JWT_ISSUER = process.env.JWT_ISSUER?.trim() || "localhost:8000"

/**
 * @swagger
 * /api/auth/make-expired:
 *   post:
 *     summary: Re-issue the current access token so it expires in 1 second (testing helper)
 *     description: >
 *       Takes the currently valid access token and signs a new one with the same
 *       payload but an expiry of now + 1 second. The signature stays valid; the
 *       token simply expires right after, which is useful to exercise the
 *       refresh-token flow.
 *     tags:
 *       - Auth
 *     security:
 *       - basicAuth: []
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: New short-lived access token issued (raw JWT string)
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *       401:
 *         description: Unauthorized
 */
router.post("/auth/make-expired", requireAuth(), async (req: AuthenticatedRequest, res: Response) => {
	// Reuse the verified payload from the current token, dropping the registered
	// claims so jwt.sign can set fresh ones.
	const { iat, exp, iss, ...restPayload } = req.auth!.payload ?? {}

	const access_token = jwt.sign(restPayload, JWT_SECRET, {
		expiresIn: 1, // seconds: token expires 1s from now, signature stays valid
		issuer: JWT_ISSUER
	})

	res.status(200).type("text/plain").send(access_token)
})

export default router
