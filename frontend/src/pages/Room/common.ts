import { BOARD_COLUMNS, BOARD_ROWS } from "common/constant"
import { fenPieceMap, INITIAL_BOARD_FEN, pieceFenMap } from "./constant"
import { getAvailableMoves } from "common/helper"
import { NullableCellProps, PieceCharacter, Team } from "types/GameState"
import { HistoryData } from "./types"

const totalCells = BOARD_COLUMNS * BOARD_ROWS

export function initNewGame() {
	const board = fenToBoard(INITIAL_BOARD_FEN)

	return {
		board,
		selected: null,
		availableMoves: [],
		teamTurn: "red" as Team,
		capturedPieces: {
			red: [],
			black: []
		}
	}	
}

/**
 * Scans a single line from `from` in the given `step` direction.
 * In chariot mode: adds all empty squares and the first enemy piece.
 * In cannon mode: adds empty squares before the screen, then only an enemy piece after it.
 */
export function scanLine(
	gameState: NullableCellProps[],
	from: number,
	step: number,
	isValid: (current: number) => boolean,
	team: Team,
	cannon = false
): number[] {
	const result: number[] = []
	let cur = from + step
	let hasScreen = false
	while (isValid(cur)) {
		const cell = gameState[cur]
		if (!cannon) {
			if (!cell) { result.push(cur); cur += step; continue }
			if (cell.team !== team) result.push(cur)
			break
		} else {
			if (!hasScreen) {
				if (!cell) { result.push(cur); cur += step; continue }
				hasScreen = true
			} else {
				if (!cell) { cur += step; continue }
				if (cell.team !== team) result.push(cur)
				break
			}
		}
		cur += step
	}
	return result
}

export function pushElephantIfValid(gameState: NullableCellProps[], fromId: number, toId: number) {
	if (toId < 0 || toId >= totalCells) {
		return []
	}

	const selectedPiece = gameState[fromId]!
	const targetCell = gameState[toId]
	if (!targetCell || targetCell.team !== selectedPiece.team) {
		return [toId]
	}

	return []
}

export function toIndex(row: number, col: number) {
	return row * BOARD_COLUMNS + col
}

export function inBounds(row: number, col: number) {
	return row >= 0 && row < BOARD_ROWS && col >= 0 && col < BOARD_COLUMNS
}

export function isInPalace(from: number, target: number) {
	if (target < 0 || target >= totalCells) return false
	const col = target % BOARD_COLUMNS
	if (col < 3 || col > 5) return false // out of palace boundaries on the left or right side
	// return true if both from and target index are in the same top or bottom palace
	if (from / BOARD_COLUMNS <= 3) return target / BOARD_COLUMNS <= 3
	if (from / BOARD_COLUMNS >= 7) return target / BOARD_COLUMNS >= 7
	return false
}

export function pushHorseTarget(gameState: NullableCellProps[], selectedId: number, index: number) {
	if (index < 0 || index >= totalCells) {
		return []
	}

	const selectedPiece = gameState[selectedId]!
	const targetCell = gameState[index]
	if (!targetCell || targetCell.team !== selectedPiece.team) {
		return [index]
	}
	return []
}

export function getCapturedPiecesFromHistory(records: HistoryData[]) {
	const historyWithCaptured = records.filter(record => record.capture)
	if (historyWithCaptured.length > 0) {
		const captures = historyWithCaptured.map(m => m.capture as PieceCharacter)
		const red = captures.filter(c => c && c === c.toUpperCase())
		const black = captures.filter(c => c && c === c.toLowerCase())

		return { red, black }
	}

	return {
		red: [] as PieceCharacter[],
		black: [] as PieceCharacter[]
	}
}

export function isGeneralInCheck(board: NullableCellProps[], team: Team) {
	const generalIndex = board.findIndex(cell => cell?.piece === "general" && cell.team === team)
	if (generalIndex < 0) return false

	const enemyTeam: Team = team === "red" ? "black" : "red"

	for (let id = 0; id < board.length; id += 1) {
		const cell = board[id]
		if (!cell || cell.team !== enemyTeam) continue

		const enemyDirection = cell.team === "red" ? -1 : 1
		const moves = getAvailableMoves(board, id, enemyDirection)
		if (moves.includes(generalIndex)) {
			return true
		}
	}

	return false
}

export function fenToBoard(fen: string): NullableCellProps[] {
	const rows = fen.trim().split("/")
	if (rows.length !== BOARD_ROWS) {
		throw new Error(`Invalid FEN row count: expected ${BOARD_ROWS}, got ${rows.length}`)
	}

	const board: NullableCellProps[] = []

	for (const rowText of rows) {
		for (const token of rowText) {
			if (token >= "1" && token <= "9") {
				const emptyCount = Number(token)
				for (let i = 0; i < emptyCount; i += 1) {
					board.push(null)
				}
				continue
			}

			const piece = fenPieceMap[token.toLowerCase() as PieceCharacter]
			if (!piece) {
				throw new Error(`Invalid FEN piece token: '${token}'`)
			}

			const id = board.length
			const isLowerCase = token === token.toLowerCase()
			board.push({
				id,
				piece,
				team: isLowerCase ? "red" : "black"
			})
		}

		if (board.length % BOARD_COLUMNS !== 0) {
			throw new Error("Invalid FEN: a row does not have exactly 9 cells")
		}
	}

	if (board.length !== totalCells) {
		throw new Error(`Invalid FEN board size: expected ${totalCells}, got ${board.length}`)
	}

	return board
}

export function boardToFen(board: NullableCellProps[]): string {
	if (board.length !== totalCells) {
		throw new Error(`Invalid board size: expected ${totalCells}, got ${board.length}`)
	}

	const rows: string[] = []

	for (let row = 0; row < BOARD_ROWS; row += 1) {
		let rowFen = ""
		let emptyCount = 0

		for (let col = 0; col < BOARD_COLUMNS; col += 1) {
			const index = row * BOARD_COLUMNS + col
			const cell = board[index]

			if (!cell) {
				emptyCount += 1
				continue
			}

			if (emptyCount > 0) {
				rowFen += String(emptyCount)
				emptyCount = 0
			}

			const token = pieceFenMap[cell.piece]
			rowFen += cell.team === "red" ? token : token.toUpperCase()
		}

		if (emptyCount > 0) {
			rowFen += String(emptyCount)
		}

		rows.push(rowFen)
	}

	return rows.join("/")
}
