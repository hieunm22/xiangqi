import { flatArrayToProjectFen, projectFenToFlatArray } from "./fen-converter"

/**
 * Apply a from/to move to a project FEN and return the new FEN plus any captured piece.
 *
 * The captured piece is returned in its original case (the FEN char that was on `toIdx`),
 * or null if the destination was empty.
 */
export const applyMoveToProjectFen = (
	projectFen: string,
	fromIdx: number,
	toIdx: number
): { newFen: string; capturePiece: string | null } => {
	const cells = projectFenToFlatArray(projectFen)
	const moving = cells[fromIdx]
	if (!moving) {
		throw new Error(`No piece at fromIdx=${fromIdx} in FEN '${projectFen}'`)
	}
	const captured = cells[toIdx]
	cells[toIdx] = moving
	cells[fromIdx] = null
	return {
		newFen: flatArrayToProjectFen(cells),
		capturePiece: captured ?? null
	}
}
