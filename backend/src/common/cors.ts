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

/**
 * True for localhost and RFC1918 private-LAN hosts, on any port.
 */
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
 * Whether a request origin is allowed.
 * No-origin and whitelisted origins always pass; LAN origins only outside production.
 */
export function isOriginAllowed(requestOrigin: string | undefined, allowedOrigins: string[]): boolean {
	const isDevelopment = process.env.NODE_ENV !== "production"
	return (
		!requestOrigin ||
		allowedOrigins.includes(requestOrigin) ||
		(isDevelopment && isPrivateLanOrigin(requestOrigin))
	)
}
