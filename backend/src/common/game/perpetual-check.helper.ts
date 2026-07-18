import { getGameHistoryCollection } from "common/mongodb"
import { Team } from "types/game.type"
import { evaluateTeamState } from "./state-evaluator"

export const PERPETUAL_CHECK_WARNING_REPETITION = 5
export const PERPETUAL_CHECK_LOSS_REPETITION = 6

// none = not (yet) perpetual, warning = repeated enough to warn, loss = checker loses.
export type PerpetualCheckStatus = "none" | "warning" | "loss"

// `occurrences` is how many times the current checking position (same board, same
// side to move) has recurred in the game history
export type PerpetualCheckResult = {
	status: PerpetualCheckStatus
	occurrencesCount: number
}

type Position = { fen: string; team: Team }

// First FEN field. Human moves persist project FEN, bot moves standard FEN — both
// share placement, so compare on placement to match positions across move sources.
const placement = (fen: string): string => fen.trim().split(/\s+/)[0]

// True when checkedTeam is in check on every one of its turns in [start, end].
// A single non-check turn means the checks aren't continuous (a chase, not 長將).
const allChecksInRange = (
	positions: Position[],
	start: number,
	end: number,
	checkedTeam: Team,
	redFirst: boolean
): boolean => {
	for (let index = start; index <= end; index += 1) {
		if (positions[index].team !== checkedTeam) {
			continue
		}
		if (!evaluateTeamState(positions[index].fen, checkedTeam, redFirst).inCheck) {
			return false
		}
	}
	return true
}

// Game positions from history, oldest-first. Each record's `team` is the side to
// move, `fen` the board after the move — so (fen, team) identifies position + turn.
async function loadPositions(gameId: string): Promise<Position[]> {
	const collection = await getGameHistoryCollection()
	const records = await collection
		.find({ $or: [{ game_id: gameId }, { gameId }] })
		.sort({ _id: 1 })
		.toArray()

	return records
		.filter(record => typeof record.fen === "string" && (record.team === "red" || record.team === "black"))
		.map(record => ({ fen: record.fen as string, team: record.team as Team }))
}

// Indices of history positions matching `targetPlacement` with `checkedTeam` to move.
function findOccurrences(positions: Position[], targetPlacement: string, checkedTeam: Team): number[] {
	const occurrences: number[] = []
	positions.forEach((position, index) => {
		if (placement(position.fen) === targetPlacement && position.team === checkedTeam) {
			occurrences.push(index)
		}
	})
	return occurrences
}

	// Perpetual check (長將): detects if checkedTeam has been in check every turn across a repeating position.
	// Returns status ("loss"/"warning"/"none") and occurrence count. Call only when checkedTeam is in check.
export async function evaluatePerpetualCheck(
	gameId: string,
	newFen: string,
	checkedTeam: Team,
	redFirst: boolean
): Promise<PerpetualCheckResult> {
	const positions = await loadPositions(gameId)

	// Occurrences of the current checking position (same board, same side to move).
	const targetPlacement = placement(newFen)
	const occurrences = findOccurrences(positions, targetPlacement, checkedTeam)

	const count = occurrences.length
	const end = occurrences[count - 1]

	// Only the most recent repetitions, so an early coincidental one doesn't pollute
	// the continuity check.
	if (count >= PERPETUAL_CHECK_LOSS_REPETITION) {
		const lossStart = occurrences[count - PERPETUAL_CHECK_LOSS_REPETITION]
		if (allChecksInRange(positions, lossStart, end, checkedTeam, redFirst)) {
			return { status: "loss", occurrencesCount: count }
		}
	}

	if (count >= PERPETUAL_CHECK_WARNING_REPETITION) {
		const warnStart = occurrences[count - PERPETUAL_CHECK_WARNING_REPETITION]
		if (allChecksInRange(positions, warnStart, end, checkedTeam, redFirst)) {
			return { status: "warning", occurrencesCount: count }
		}
	}

	return { status: "none", occurrencesCount: count }
}

	// Would `candidateFen` complete a perpetual-check loss for the checker (counts as one extra occurrence)?
	// Caller must confirm it is a check — a non-check breaks the chain and never qualifies.
export async function wouldCompletePerpetualLoss(
	gameId: string,
	candidateFen: string,
	checkedTeam: Team,
	redFirst: boolean
): Promise<boolean> {
	const positions = await loadPositions(gameId)
	const occurrences = findOccurrences(positions, placement(candidateFen), checkedTeam)

	// Playing the candidate adds one more occurrence of this checking position.
	const effectiveCount = occurrences.length + 1
	if (effectiveCount < PERPETUAL_CHECK_LOSS_REPETITION) {
		return false
	}

	// The preceding (LOSS - 1) occurrences must form a continuous check chain; the
	// candidate (a check, per the caller) becomes the LOSS-th.
	const start = occurrences[occurrences.length - (PERPETUAL_CHECK_LOSS_REPETITION - 1)]
	const end = occurrences[occurrences.length - 1]
	return allChecksInRange(positions, start, end, checkedTeam, redFirst)
}
