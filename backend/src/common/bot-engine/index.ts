export { BOT_USER_ID, MAX_DIFFICULTY, MIN_DIFFICULTY } from "./constants"
import { BotMoveResult, RequestBotMoveParams } from "types/game.type"
import { getDifficultyConfig } from "./difficulty"
import { projectFenToStandardFen } from "./fen-converter"
import { engineManager } from "./manager"
import { applyMoveToProjectFen } from "./move-applier"
import { uciMoveToProjectIndices } from "./uci-move"
export { isValidDifficulty } from "./difficulty"
export { engineManager }

/**
 * Ask the engine for the bot's reply move and apply it to the project FEN.
 * Returns the updated FEN + any captured piece (in the bot's-team case convention).
 * Returns null when the engine has no legal moves (bot is in checkmate).
 */
export const requestBotMove = async (params: RequestBotMoveParams): Promise<BotMoveResult | null> => {
	const { gameId, projectFen, redFirst, botTeam, difficulty } = params
	const config = getDifficultyConfig(difficulty)
	const standardFen = projectFenToStandardFen(projectFen, redFirst, botTeam)
	const engine = await engineManager.getEngineForGame(gameId)
	const uci = await engine.findBestMove(standardFen, config)
	if (uci === null) {
		return null
	}
	const { fromIdx, toIdx } = uciMoveToProjectIndices(uci, redFirst)
	const { newFen, capturePiece } = applyMoveToProjectFen(projectFen, fromIdx, toIdx)
	return { uci, newFen, capturePiece }
}
