import { CapturedPieces, Team } from "types/GameState"
import { HistoryData } from "../types"

/**
 * Group history captures by capturer team, keyed by team name.
 */
export function groupCaptures(
	history: HistoryData[],
	teamOf: (piece?: string | null) => Team | null,
	otherTeam: (team: Team) => Team
): CapturedPieces {
	const result: CapturedPieces = {}
	for (const record of history) {
		if (!record.capture) continue
		const owner = teamOf(record.capture)
		if (!owner) continue
		const capturer = otherTeam(owner)
			; (result[capturer] ??= []).push(record.capture)
	}
	return result
}
