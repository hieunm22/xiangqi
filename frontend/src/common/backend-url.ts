export function resolveBackendBaseUrl(): string {
	const configured = import.meta.env.VITE_BACKEND_BASE_URL?.trim()

	// No explicit backend configured: prefer the current origin (same-origin deploy),
	// falling back to the conventional local backend port.
	if (!configured) {
		if (typeof window !== "undefined" && window.location?.origin) {
			return window.location.origin
		}
		return "http://localhost:8000"
	}

	if (!import.meta.env.DEV || typeof window === "undefined") {
		return configured
	}

	try {
		const backendUrl = new URL(configured)
		const isLocalhostBackend = ["localhost", "127.0.0.1"].includes(backendUrl.hostname)
		const pageHost = window.location.hostname
		const pageIsLan = pageHost && !["localhost", "127.0.0.1"].includes(pageHost)

		if (isLocalhostBackend && pageIsLan) {
			backendUrl.hostname = pageHost
			return backendUrl.origin
		}
	} catch {
		return configured
	}

	return configured
}
