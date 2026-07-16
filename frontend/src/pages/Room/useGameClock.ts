import { useEffect, useState } from "react"
import { Team } from "types/GameState"
import { ClockSnapshot } from "./types"

const TICK_MS = 250

export interface ClockDisplay {
	redMs: number
	blackMs: number
	activeTeam: Team
	timePerMove: number
	redPerMoveMs: number
	blackPerMoveMs: number
}

/**
 * Convert the server clock snapshot into a smoothly-ticking local display.
 * Anchors to client-local arrival time to avoid clock-skew jumps.
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

	const perMoveCapMs = (s.timePerMove ?? 0) * 1000
	const activePerMoveMs = Math.max(0, (s.perMoveRemainingMs ?? 0) - elapsed)

	return {
		redMs: s.activeTeam === "red" ? Math.max(0, s.redMs - elapsed) : s.redMs,
		blackMs: s.activeTeam === "black" ? Math.max(0, s.blackMs - elapsed) : s.blackMs,
		activeTeam: s.activeTeam,
		timePerMove: s.timePerMove ?? 0,
		redPerMoveMs: s.activeTeam === "red" ? activePerMoveMs : perMoveCapMs,
		blackPerMoveMs: s.activeTeam === "black" ? activePerMoveMs : perMoveCapMs,
	}
}

/**
 * Format a millisecond duration as mm:ss (rounding up so a full budget reads e.g. 10:00).
 */
export function formatClock(ms: number): string {
	const totalSeconds = Math.max(0, Math.ceil(ms / 1000))
	const minutes = Math.floor(totalSeconds / 60)
	const seconds = totalSeconds % 60
	return `${minutes}:${seconds.toString().padStart(2, "0")}`
}
