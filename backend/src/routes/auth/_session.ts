import { Response } from "express"
import crypto from "crypto"
import jwt from "jsonwebtoken"
import prisma from "prisma"
import {
	ACCESS_TOKEN_EXPIRES_IN,
	LOGIN_SESSION_KEY,
	REFRESH_TOKEN_KEY,
	REFRESH_TOKEN_TTL_SECONDS
} from "common/constant"
import redis from "common/redis"
import { getRefreshCookieOptions } from "common/cookie"
import { LoginSession, LoginSuccessResponse } from "types/auth.type"

const JWT_SECRET = process.env.JWT_SECRET!
const JWT_ISSUER = process.env.JWT_ISSUER?.trim() || "localhost:8000"

interface EstablishSessionParams {
	userId: number
	timezoneOffset: number
	deviceName: string
}

/**
 * Create an authenticated session for a user and write it to the response.
 * Shared by every login path (password, Google, ...)
 */
export const establishUserSession = async (
	res: Response,
	{ userId, timezoneOffset, deviceName }: EstablishSessionParams
): Promise<LoginSuccessResponse> => {
	const sessionId = crypto.randomUUID()
	const payload = {
		sub: userId,
		jti: sessionId,
		timezoneOffset: Number(timezoneOffset)
	}

	const access_token = jwt.sign(payload, JWT_SECRET, {
		expiresIn: ACCESS_TOKEN_EXPIRES_IN,
		issuer: JWT_ISSUER
	})

	// Keep login session valid for the full refresh window.
	const sessionValue = JSON.stringify({
		userId,
		deviceName: deviceName?.trim() ?? "",
		clientId: sessionId,
		createdAt: new Date().toISOString(),
		isValid: true
	} as LoginSession)
	await redis.set(`${LOGIN_SESSION_KEY}:${userId}:${sessionId}`, sessionValue, "EX", REFRESH_TOKEN_TTL_SECONDS)

	// refresh_token should be a guid id
	const refresh_token = crypto.randomUUID()

	// Store refresh token in Redis with key refresh-token:<user-id>:<session-id>, expiration 30 days
	await redis.set(`${REFRESH_TOKEN_KEY}:${userId}:${sessionId}`, refresh_token, "EX", REFRESH_TOKEN_TTL_SECONDS)

	// On a user's very first login, seed an announcement "read" baseline so a
	// brand-new user is treated as caught up with existing announcements while
	// still seeing announcements created afterwards as unread. Non-critical:
	// never block login if this fails.
	try {
		const existingRead = await prisma.userAnnouncementRead.findFirst({
			where: { user_id: userId },
			select: { id: true }
		})

		if (!existingRead) {
			await prisma.userAnnouncementRead.create({
				data: { user_id: userId, session_id: sessionId }
			})
		}
	} catch (seedError) {
		console.error("Failed to seed announcement read baseline:", seedError)
	}

	const cookieOptions = getRefreshCookieOptions(REFRESH_TOKEN_TTL_SECONDS * 1000)
	res.cookie(REFRESH_TOKEN_KEY, refresh_token, cookieOptions)

	return {
		success: true,
		message: "login.messages.success",
		status_code: 200,
		access_token,
		refresh_token,
		token_type: "Bearer"
	}
}
