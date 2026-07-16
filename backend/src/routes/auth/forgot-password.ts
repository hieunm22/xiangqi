import { Request, Response, Router } from "express"
import crypto from "crypto"
import fs from "fs"
import path from "path"
import nodemailer from "nodemailer"
import prisma from "prisma"
import redis from "common/redis"
import { FORGOT_PASSWORD_KEY } from "common/constant"
import { ForgotPasswordRequest } from "types/auth.type"

const router = Router()

const senderEmail = process.env.APP_EMAIL?.trim() || ""
const senderPassword = process.env.GOOGLE_APP_PASSWORD?.trim() || ""

const missingMailerCredentials = !senderEmail || !senderPassword

const mailer = nodemailer.createTransport({
	service: "gmail",
	auth: {
		user: senderEmail,
		pass: senderPassword
	}
})

const forgotPasswordTemplatePath = path.resolve(__dirname, "../../templates/lost-password.html")

const replaceTemplateToken = (template: string, token: string, value: string) =>
	template.split(token).join(value)

const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)

const ensureResetBaseUrl = (baseUrl: string, req: Request) => {
	const normalizedBaseUrl = baseUrl.replace(/\/$/, "")
	const requestHost = req.get("host")?.trim()

	if (!requestHost) {
		return normalizedBaseUrl
	}

	try {
		const baseHost = new URL(normalizedBaseUrl).host
		if (baseHost === requestHost) {
			return `${normalizedBaseUrl}/api/auth`
		}
	} catch {
		// Keep fallback behavior when base url is not parseable.
	}

	return normalizedBaseUrl
}

const getCallerDomain = (req: Request) => {
	const origin = req.get("origin")?.trim()
	if (origin) {
		return ensureResetBaseUrl(origin, req)
	}

	const referer = req.get("referer")?.trim()
	if (referer) {
		try {
			return ensureResetBaseUrl(new URL(referer).origin, req)
		} catch {
			// Ignore invalid referer format and continue with fallback options.
		}
	}

	const host = req.get("host")?.trim()
	if (host) {
		return ensureResetBaseUrl(`${req.protocol}://${host}`, req)
	}

	return ""
}

const normalizeBaseUrl = () => {
	const frontendBaseUrl = process.env.FRONTEND_BASE_URL?.trim()
	if (frontendBaseUrl) {
		return frontendBaseUrl.replace(/\/$/, "")
	}

	const firstCorsOrigin = process.env.CORS_ORIGINS?.split(",")
		.map(origin => origin.trim())
		.filter(Boolean)[0]

	return (firstCorsOrigin || "http://localhost:3004").replace(/\/$/, "")
}

/**
 * @swagger
 * /api/auth/forgot-password:
 *   post:
 *     summary: Send forgot password email
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
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *     responses:
 *       200:
 *         description: Forgot password email sent
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
 *                   example: forgot-password.messages.success
 *                 status_code:
 *                   type: integer
 *                   example: 200
 *       400:
 *         description: Missing email or invalid email format
 *       409:
 *         description: Email not found
 *       500:
 *         description: Internal server error or email service not configured
 */
router.post("/auth/forgot-password", async (req: Request, res: Response) => {
	const { email } = req.body as ForgotPasswordRequest
	const normalizedEmail = (email || "").trim().toLowerCase()

	if (!normalizedEmail) {
		res.status(400).json({
			success: false,
			message: "forgot-password.messages.missing-email",
			status_code: 400
		})
		return
	}

	if (!isValidEmail(normalizedEmail)) {
		res.status(400).json({
			success: false,
			message: "forgot-password.messages.invalid-email-format",
			status_code: 400
		})
		return
	}

	if (missingMailerCredentials) {
		console.error("Forgot password mailer is not configured. Set this environment variable: APP_PASSWORD")
		res.status(500).json({
			success: false,
			message: "forgot-password.messages.email-service-not-configured",
			status_code: 500
		})
		return
	}

	try {
		const user = await prisma.user.findUnique({
			where: { email: normalizedEmail },
			select: {
				id: true,
				user_name: true,
				display_name: true,
				email: true
			}
		})

		if (!user) {
			res.status(409).json({
				success: false,
				message: "forgot-password.messages.email-not-found",
				status_code: 409
			})
			return
		}

		const forgotPasswordGuid = crypto.randomUUID()
		await redis.set(`${FORGOT_PASSWORD_KEY}:${user.id.toString()}`, forgotPasswordGuid, "EX", 60 * 60)

		const htmlTemplate = fs.readFileSync(forgotPasswordTemplatePath, "utf-8")
		const resetBaseUrl = getCallerDomain(req) || normalizeBaseUrl()
		const htmlBody = [
			["{displayName}", user.display_name],
			["{domain}", resetBaseUrl],
			["{id}", user.id.toString()],
			["{token}", forgotPasswordGuid],
			["{userName}", user.user_name]
		].reduce((content, [token, value]) => replaceTemplateToken(content, token, value), htmlTemplate)

		await mailer.sendMail({
			from: senderEmail,
			to: user.email,
			subject: `Reset Password detail for ${user.user_name}`,
			html: htmlBody
		})

		res.status(200).json({
			success: true,
			message: "forgot-password.messages.success",
			status_code: 200
		})
	} catch (error) {
		console.error("Forgot password error:", error)
		res.status(500).json({
			success: false,
			message: "forgot-password.messages.internal-server-error",
			status_code: 500
		})
	}
})

export default router
