import { BOARD_COLUMNS, BOARD_ROWS, BOARD_SIZE } from "./constants"
import { projectPieceToStandard } from "./piece-map"
import { Team } from "types/game.type"

/**
 * Parse a project FEN (board-only, no side-to-move suffix) into a flat array of 90 cells.
 * Empty squares become null.
 */
export const projectFenToFlatArray = (projectFen: string): (string | null)[] => {
	// Tolerate both board-only and full 6-field FENs: take the placement field only.
	const rows = projectFen.trim().split(/\s+/)[0].split("/")
	if (rows.length !== BOARD_ROWS) {
		throw new Error(`Invalid project FEN: expected ${BOARD_ROWS} rows, got ${rows.length}`)
	}

	const cells: (string | null)[] = []
	for (const rowText of rows) {
		let cellsInRow = 0
		for (const token of rowText) {
			if (token >= "1" && token <= "9") {
				const empties = Number(token)
				for (let i = 0; i < empties; i += 1) {
					cells.push(null)
				}
				cellsInRow += empties
				continue
			}
			cells.push(token)
			cellsInRow += 1
		}
		if (cellsInRow !== BOARD_COLUMNS) {
			throw new Error(`Invalid project FEN row: expected ${BOARD_COLUMNS} cells, got ${cellsInRow}`)
		}
	}

	if (cells.length !== BOARD_SIZE) {
		throw new Error(`Invalid project FEN: expected ${BOARD_SIZE} cells, got ${cells.length}`)
	}

	return cells
}

/**
 * Re-encode a flat array of 90 cells back into a project FEN string.
 */
export const flatArrayToProjectFen = (cells: (string | null)[]): string => {
	if (cells.length !== BOARD_SIZE) {
		throw new Error(`Invalid cells length: expected ${BOARD_SIZE}, got ${cells.length}`)
	}

	const rows: string[] = []
	for (let row = 0; row < BOARD_ROWS; row += 1) {
		let rowFen = ""
		let empties = 0
		for (let col = 0; col < BOARD_COLUMNS; col += 1) {
			const cell = cells[row * BOARD_COLUMNS + col]
			if (cell === null) {
				empties += 1
				continue
			}
			if (empties > 0) {
				rowFen += String(empties)
				empties = 0
			}
			rowFen += cell
		}
		if (empties > 0) {
			rowFen += String(empties)
		}
		rows.push(rowFen)
	}
	return rows.join("/")
}

/**
 * Convert a project FEN to a standard xiangqi FEN for fairy-stockfish.
 * Rotates board when `redFirst` is false; returns `<placement> <side> - - 0 1`.
 */
export const projectFenToStandardFen = (
	projectFen: string,
	redFirst: boolean,
	sideToMove: Team
): string => {
	let cells = projectFenToFlatArray(projectFen)
	if (!redFirst) {
		cells = cells.slice().reverse()
	}

	// Translate each piece (case + letter) to standard.
	const translated = cells.map(cell => (cell === null ? null : projectPieceToStandard(cell)))
	const positionPart = flatArrayToProjectFen(translated)
	const side = sideToMove === "red" ? "w" : "b"
	return `${positionPart} ${side} - - 0 1`
}
