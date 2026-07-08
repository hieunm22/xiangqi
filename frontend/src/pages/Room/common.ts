import classnames from "classnames"
import { BOARD_COLUMNS, BOARD_ROWS } from "common/constant"
import { fenPieceMap } from "./constant"
import { getAvailableMoves } from "common/helper"
import { NullableCellProps, Piece, PieceCharacter, Team } from "types/GameState"
import { HistoryData, PieceSideUser, RoomUser } from "./types"

const totalCells = BOARD_COLUMNS * BOARD_ROWS

export function getTeamFromPieceChar(piece?: PieceCharacter | null): Team | null {
	if (!piece) {
		return null
	}

	return piece === piece.toLowerCase() ? "red" : "black"
}

export function getPieceFromCharacter(piece?: PieceCharacter | null): Piece | null {
	if (!piece) {
		return null
	}

	return fenPieceMap[piece]
}

// Reuse one Audio element per effect so rapid moves don't spawn an element per call.
const soundCache: Record<string, HTMLAudioElement> = {}

export function playSound(url: string) {
	if (typeof Audio === "undefined") {
		return
	}
	if (!soundCache[url]) {
		soundCache[url] = new Audio(url)
	}
	const sound = soundCache[url]
	sound.currentTime = 0
	// Autoplay can reject (e.g. before any user interaction); ignore it.
	sound.play().catch(() => {})
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
		const cellTeam = getTeamFromPieceChar(cell?.piece)
		if (!cannon) {
			if (!cell || !cell.piece) { result.push(cur); cur += step; continue }
			if (cellTeam !== team) result.push(cur)
			break
		} else {
			if (!hasScreen) {
				if (!cell || !cell.piece) { result.push(cur); cur += step; continue }
				hasScreen = true
			} else {
				if (!cell || !cell.piece) { cur += step; continue }
				if (cellTeam !== team) result.push(cur)
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
	const selectedTeam = getTeamFromPieceChar(selectedPiece?.piece)
	const targetCell = gameState[toId]
	const targetTeam = getTeamFromPieceChar(targetCell?.piece)
	if (!selectedTeam) {
		return []
	}

	if (!targetCell || !targetCell.piece || targetTeam !== selectedTeam) {
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
	const selectedTeam = getTeamFromPieceChar(selectedPiece?.piece)
	const targetCell = gameState[index]
	const targetTeam = getTeamFromPieceChar(targetCell?.piece)
	if (!selectedTeam) {
		return []
	}

	if (!targetCell || !targetCell.piece || targetTeam !== selectedTeam) {
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

export function findCheckingPieces(board: NullableCellProps[], team: Team): number[] {
	const generalIndex = board.findIndex(cell => getPieceFromCharacter(cell?.piece) === "general"
		&& getTeamFromPieceChar(cell?.piece) === team)
	if (generalIndex < 0) return []

	const enemyTeam: Team = team === "red" ? "black" : "red"
	const checkers: number[] = []

	for (let id = 0; id < board.length; id += 1) {
		const cell = board[id]
		if (!cell || getTeamFromPieceChar(cell.piece) !== enemyTeam) continue

		const enemyDirection = enemyTeam === "red" ? -1 : 1
		const moves = getAvailableMoves(board, id, enemyDirection)
		if (moves.includes(generalIndex)) {
			checkers.push(id)
		}
	}

	return checkers
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

			if (!(token in fenPieceMap)) {
				throw new Error(`Invalid FEN piece token: '${token}'`)
			}

			const id = board.length
			board.push({
				id,
				piece: token as PieceCharacter
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

			if (!cell || !cell.piece) {
				emptyCount += 1
				continue
			}

			if (emptyCount > 0) {
				rowFen += String(emptyCount)
				emptyCount = 0
			}

			rowFen += cell.piece
		}

		if (emptyCount > 0) {
			rowFen += String(emptyCount)
		}

		rows.push(rowFen)
	}

	return rows.join("/")
}

/** CSS classes for an intersection marker at the given column/row. */
export function markerClass(col: number, row: number): string {
	return classnames("marker", {
		"left-edge": col === 0,
		"right-edge": col === BOARD_COLUMNS - 1,
		[`row-${row} col-${col}`]: true,
	})
}

/**
 * Forward direction (-1 up, 1 down) for the team whose turn it is, given which
 * side moves first. The first-moving team always sits at the bottom (moves up).
 */
export function getMoveDirection(redFirst: boolean, turn: Team): -1 | 1 {
	const bottomTeam: Team = redFirst ? "red" : "black"
	return turn === bottomTeam ? -1 : 1
}

/** Split the two players into top/bottom seats based on which side moves first. */
export function resolveSideUsers(joinedUsers: RoomUser[], redFirst: boolean): PieceSideUser {
	const bottomTeam: Team = redFirst ? "red" : "black"
	const bottomUser = joinedUsers.find(ju => ju.team === bottomTeam) ?? null
	const topUser = joinedUsers.find(ju => ju.team !== null && ju.team !== bottomTeam) ?? null
	return {
		top: topUser,
		bottom: bottomUser,
	}
}

/** Return a new board with the piece at `fromId` moved to `toId`. */
export function applyMove(board: NullableCellProps[], fromId: number, toId: number): NullableCellProps[] {
	const next = [...board]
	const moving = next[fromId]!
	next[toId] = {
		id: toId,
		piece: moving.piece,
	}
	next[fromId] = null
	return next
}

export function countLegalMoves(board: NullableCellProps[], team: Team, redFirst: boolean): number {
	const direction = getMoveDirection(redFirst, team)
	let legalMovesCount = 0

	for (let id = 0; id < board.length; id += 1) {
		const cell = board[id]
		if (!cell || getTeamFromPieceChar(cell.piece) !== team) {
			continue
		}

		const candidateMoves = getAvailableMoves(board, id, direction)
		for (const toId of candidateMoves) {
			const nextBoard = applyMove(board, id, toId)
			const checkingPieces = findCheckingPieces(nextBoard, team)
			if (checkingPieces.length === 0) {
				legalMovesCount += 1
			}
		}
	}

	return legalMovesCount
}
