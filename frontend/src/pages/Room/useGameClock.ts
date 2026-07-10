import { useEffect, useState } from "react"
import { ClockSnapshot } from "./types"

const TICK_MS = 250

export interface ClockDisplay {
	redMs: number
	blackMs: number
	activeTeam: "red" | "black"
}

/**
 * Turn the latest server clock snapshot into a smoothly-ticking display.
 *
 * The server is authoritative for the actual time-out; this only drives the UI
 * between updates. We anchor to the client-local time the snapshot arrived
 * (rather than the server timestamp) so client/server clock skew never makes the
 * clock jump — only the active team's remaining time counts down.
 */
export default function useGameClock(
	snapshot: ClockSnapshot | null,
	running: boolean
): ClockDisplay | null {
	const [now, setNow] = useState(() => Date.now())
	// The snapshot plus the client-local time it arrived; kept in state (not a
	// ref) so it can be read during render without tripping react-hooks/refs.
	const [base, setBase] = useState<{ snapshot: ClockSnapshot; receivedAt: number } | null>(null)

	useEffect(() => {
		if (snapshot) {
			const receivedAt = Date.now()
			setBase({ snapshot, receivedAt })
			setNow(receivedAt)
		} else {
			setBase(null)
		}
	}, [snapshot])

	useEffect(() => {
		if (!snapshot || !running) {
			return
		}
		const id = setInterval(() => setNow(Date.now()), TICK_MS)
		return () => clearInterval(id)
	}, [snapshot, running])

	if (!base) {
		return null
	}

	const { snapshot: s, receivedAt } = base
	const elapsed = running ? Math.max(0, now - receivedAt) : 0

	return {
		redMs: s.activeTeam === "red" ? Math.max(0, s.redMs - elapsed) : s.redMs,
		blackMs: s.activeTeam === "black" ? Math.max(0, s.blackMs - elapsed) : s.blackMs,
		activeTeam: s.activeTeam
	}
}

/** Format a millisecond duration as mm:ss (rounding up so a full budget reads e.g. 10:00). */
export function formatClock(ms: number): string {
	const totalSeconds = Math.max(0, Math.ceil(ms / 1000))
	const minutes = Math.floor(totalSeconds / 60)
	const seconds = totalSeconds % 60
	return `${minutes}:${seconds.toString().padStart(2, "0")}`
}
