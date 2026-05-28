import { BOARD_COLUMNS, BOARD_ROWS, BOARD_SIZE } from "./constants"

/**
 * Fairy-stockfish UCI move format for xiangqi uses files a–i and ranks 1–10
 * (rank 1 is red's back rank at the bottom, rank 10 is black's back rank at
 * the top). Rank can be one OR two digits, so we can't slice fixed lengths.
 *
 *   "a1a2"   → 4 chars
 *   "a10a8"  → 5 chars (rank 10 in the from-square)
 *   "a10a10" → 6 chars
 */
const MOVE_PATTERN = /^([a-i])(10|[1-9])([a-i])(10|[1-9])/

const fileCharToCol = (file: string): number => {
	const col = file.charCodeAt(0) - "a".charCodeAt(0)
	if (col < 0 || col >= BOARD_COLUMNS) {
		throw new Error(`Invalid UCI file: '${file}'`)
	}
	return col
}

const colToFileChar = (col: number): string => {
	if (col < 0 || col >= BOARD_COLUMNS) {
		throw new Error(`Invalid file column: ${col}`)
	}
	return String.fromCharCode("a".charCodeAt(0) + col)
}

/**
 * Standard board index: rank 1 at the bottom (row 9), rank 10 at the top (row 0).
 */
const fileRankToStandardIndex = (file: string, rank: number): number => {
	if (!Number.isInteger(rank) || rank < 1 || rank > BOARD_ROWS) {
		throw new Error(`Invalid UCI rank: ${rank}`)
	}
	const col = fileCharToCol(file)
	const row = BOARD_ROWS - rank
	return row * BOARD_COLUMNS + col
}

const standardIndexToFileRank = (index: number): { file: string; rank: number } => {
	if (index < 0 || index >= BOARD_SIZE) {
		throw new Error(`Invalid standard index: ${index}`)
	}
	const row = Math.floor(index / BOARD_COLUMNS)
	const col = index % BOARD_COLUMNS
	return {
		file: colToFileChar(col),
		rank: BOARD_ROWS - row
	}
}

/**
 * Convert a UCI move (e.g. "h3e3" or "a10a8") from fairy-stockfish into project
 * board indices (0 = top-left of project FEN, 89 = bottom-right).
 *
 * When `redFirst` is false the project board is rotated 180° vs standard, so we
 * mirror the index: project_idx = 89 - standard_idx.
 */
export const uciMoveToProjectIndices = (
	uciMove: string,
	redFirst: boolean
): { fromIdx: number; toIdx: number } => {
	const match = MOVE_PATTERN.exec(uciMove.trim())
	if (!match) {
		throw new Error(`Invalid UCI move: '${uciMove}'`)
	}
	const [, fromFile, fromRankStr, toFile, toRankStr] = match
	const fromStandard = fileRankToStandardIndex(fromFile, Number(fromRankStr))
	const toStandard = fileRankToStandardIndex(toFile, Number(toRankStr))
	if (redFirst) {
		return { fromIdx: fromStandard, toIdx: toStandard }
	}
	return {
		fromIdx: BOARD_SIZE - 1 - fromStandard,
		toIdx: BOARD_SIZE - 1 - toStandard
	}
}

/**
 * Convert a pair of project board indices into a UCI move string (used when we
 * need to feed a player's move back to the engine).
 */
export const projectIndicesToUciMove = (
	fromIdx: number,
	toIdx: number,
	redFirst: boolean
): string => {
	const fromStandard = redFirst ? fromIdx : BOARD_SIZE - 1 - fromIdx
	const toStandard = redFirst ? toIdx : BOARD_SIZE - 1 - toIdx
	const from = standardIndexToFileRank(fromStandard)
	const to = standardIndexToFileRank(toStandard)
	return `${from.file}${from.rank}${to.file}${to.rank}`
}
