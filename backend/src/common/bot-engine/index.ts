export { BOT_USER_ID, MAX_DIFFICULTY, MIN_DIFFICULTY } from "./constants"
import { BotMoveResult, RequestBotMoveParams } from "types/game.type"
import { getDifficultyConfig } from "./difficulty"
import { projectFenToStandardFen } from "./fen-converter"
import { engineManager } from "./manager"
import { applyMoveToProjectFen } from "./move-applier"
import { uciMoveToProjectIndices } from "./uci-move"
export { isValidDifficulty } from "./difficulty"
export { engineManager }

// How many ranked alternatives to request when the top move must be avoided.
const MULTIPV_CANDIDATES = 5

export interface RequestBotMoveOptions {
	// Return true to reject a candidate; the engine falls back to the next ranked
	// alternative. Used to steer the bot away from a perpetual-check loss.
	rejectMove?: (candidate: BotMoveResult) => Promise<boolean> | boolean
	// How many ranked candidates to consider when the top move is rejected.
	multipvCandidates?: number
}

const buildResult = (uci: string, projectFen: string, redFirst: boolean): BotMoveResult => {
	const { fromIdx, toIdx } = uciMoveToProjectIndices(uci, redFirst)
	const { newFen, capturePiece } = applyMoveToProjectFen(projectFen, fromIdx, toIdx)
	return { uci, newFen, capturePiece }
}

/**
 * Ask the engine for the bot's move and apply it to the project FEN.
 * Falls back through MultiPV alternatives if `rejectMove` rejects the top; null if no legal moves.
 */
export const requestBotMove = async (
	params: RequestBotMoveParams,
	options: RequestBotMoveOptions = {}
): Promise<BotMoveResult | null> => {
	const { gameId, projectFen, redFirst, botTeam, difficulty } = params
	const { rejectMove, multipvCandidates = MULTIPV_CANDIDATES } = options
	const config = getDifficultyConfig(difficulty)
	const standardFen = projectFenToStandardFen(projectFen, redFirst, botTeam)
	const engine = await engineManager.getEngineForGame(gameId)

	const uci = await engine.findBestMove(standardFen, config)
	if (uci === null) {
		return null
	}

	const best = buildResult(uci, projectFen, redFirst)
	if (!rejectMove || !(await rejectMove(best))) {
		return best
	}

	// Top move rejected - take the best accepted alternative (list includes the top
	// move, which we skip).
	const candidates = await engine.findBestMoves(standardFen, config, multipvCandidates)
	for (const candidateUci of candidates) {
		if (candidateUci === uci) {
			continue
		}
		let candidate: BotMoveResult
		try {
			candidate = buildResult(candidateUci, projectFen, redFirst)
		} catch {
			// Skip an unparsable/illegal candidate rather than aborting the fallback.
			continue
		}
		if (!(await rejectMove(candidate))) {
			return candidate
		}
	}

	// No acceptable alternative (forced position) - play the top move.
	return best
}
