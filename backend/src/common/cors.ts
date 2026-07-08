// Shared CORS origin rules for both the Express API (app.ts) and the Socket.io
// server (socket.ts) so HTTP requests and WebSocket handshakes accept the same
// set of origins. In development we additionally allow any localhost /
// private-LAN origin on any port, so the app can be opened from a phone or
// another device via the machine's LAN IP (e.g. http://192.168.1.3:3004)
// without hardcoding every address. Never relaxed in production.

/**
 * Explicit whitelist from CORS_ORIGINS, plus the Swagger UI origin (same host as
 * the API server) so the docs page can call the API.
 */
export function getAllowedOrigins(): string[] {
	const rawOrigins = process.env.CORS_ORIGINS ?? "http://localhost:3004"
	const allowedOrigins = rawOrigins.split(",").map(o => o.trim()).filter(Boolean)

	const port = process.env.PORT ?? "8000"
	const swaggerOrigin = `http://localhost:${port}`
	if (!allowedOrigins.includes(swaggerOrigin)) {
		allowedOrigins.push(swaggerOrigin)
	}

	return allowedOrigins
}

/** True for localhost and RFC1918 private-LAN hosts, on any port. */
export function isPrivateLanOrigin(requestOrigin: string): boolean {
	try {
		const { hostname } = new URL(requestOrigin)
		return (
			hostname === "localhost" ||
			hostname === "127.0.0.1" ||
			hostname === "::1" ||
			/^10\./.test(hostname) ||
			/^192\.168\./.test(hostname) ||
			/^172\.(1[6-9]|2\d|3[01])\./.test(hostname)
		)
	} catch {
		return false
	}
}

/**
 * Whether a request origin is allowed. Server-to-server calls (no origin) and
 * whitelisted origins always pass; localhost/private-LAN origins pass only
 * outside production.
 */
export function isOriginAllowed(requestOrigin: string | undefined, allowedOrigins: string[]): boolean {
	const isDevelopment = process.env.NODE_ENV !== "production"
	return (
		!requestOrigin ||
		allowedOrigins.includes(requestOrigin) ||
		(isDevelopment && isPrivateLanOrigin(requestOrigin))
	)
}
