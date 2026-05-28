import { CookieOptions } from "express"

/**
 * Shared options for the refresh-token cookie.
 *
 * The frontend and the API are served from different origins,
 * so the cookie is sent on cross-origin requests.
 * A cookie is only sent cross-origin when it is `SameSite=None` AND
 * `Secure`. Gating these on NODE_ENV is fragile (if NODE_ENV isn't exactly
 * "production" at runtime the cookie falls back to SameSite=Lax and is dropped
 * on the refresh request), so we drive them from explicit env vars with
 * cross-origin-friendly defaults.
 *
 * For a pure local http setup (no HTTPS) set in the env:
 *   COOKIE_SECURE=false
 *   COOKIE_SAMESITE=lax
 */
const parseSameSite = (value?: string): CookieOptions["sameSite"] => {
	switch (value?.trim().toLowerCase()) {
		case "lax":
			return "lax"
		case "strict":
			return "strict"
		case "none":
			return "none"
		default:
			return "none"
	}
}

export const getRefreshCookieOptions = (maxAge: number): CookieOptions => {
	const sameSite = parseSameSite(process.env.COOKIE_SAMESITE)
	// SameSite=None requires Secure; default secure to true unless explicitly disabled.
	const secure = process.env.COOKIE_SECURE
		? process.env.COOKIE_SECURE.trim().toLowerCase() !== "false"
		: true
	const domain = process.env.COOKIE_DOMAIN?.trim() || undefined

	return {
		httpOnly: true,
		secure: sameSite === "none" ? true : secure,
		sameSite,
		path: "/",
		maxAge,
		...(domain ? { domain } : {})
	}
}
