import { useEffect, useRef } from "react"
import { useSocket } from "hooks/useSocket"

// How often a visible tab reports it is still alive. The backend treats a user
// as offline once no heartbeat arrives within its own (longer) threshold.
const HEARTBEAT_INTERVAL_MS = 60 * 1000

/**
 * Keeps the current user's presence fresh while they have a visible tab.
 *
 * The heartbeat is gated on `document.visibilityState`: it pings immediately
 * when the tab becomes visible and on a fixed interval thereafter, and stops
 * while the tab is hidden
 */
export function usePresenceHeartbeat(userId: number | null | undefined) {
	const { emitPresencePing } = useSocket()
	const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

	useEffect(() => {
		if (!userId) {
			return
		}

		const ping = () => emitPresencePing(userId)

		const stop = () => {
			if (intervalRef.current !== null) {
				clearInterval(intervalRef.current)
				intervalRef.current = null
			}
		}

		const start = () => {
			if (intervalRef.current !== null) {
				return
			}
			ping()
			intervalRef.current = setInterval(ping, HEARTBEAT_INTERVAL_MS)
		}

		const handleVisibilityChange = () => {
			if (document.visibilityState === "visible") {
				start()
			} else {
				stop()
			}
		}

		handleVisibilityChange()
		document.addEventListener("visibilitychange", handleVisibilityChange)

		return () => {
			document.removeEventListener("visibilitychange", handleVisibilityChange)
			stop()
		}
	}, [userId, emitPresencePing])
}

export default usePresenceHeartbeat
