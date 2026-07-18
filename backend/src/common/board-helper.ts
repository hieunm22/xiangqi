import { Team } from "types/game.type"

const BOARD_ROWS = 10
const BOARD_COLUMNS = 9

const fenPieceMap: Record<string, string> = {
	g: "general",
	a: "advisor",
	e: "elephant",
	h: "horse",
	r: "chariot",
	c: "cannon",
	s: "soldier",
}

const pieceFenMap: Record<string, string> = {
	general: "g",
	advisor: "a",
	elephant: "e",
	horse: "h",
	chariot: "r",
	cannon: "c",
	soldier: "s"
}

interface CellProps {
	id: number
	piece: string
	team: Team
	animateTo?: number
}

/**
 * Read the half-move / full-move counters from a FEN. Board-only strings (no fields
 * beyond the placement) default to half-move 0 and full-move 1.
 */
export const parseFenCounters = (fen: string): { halfmove: number; fullmove: number } => {
	const parts = fen.trim().split(/\s+/)
	const halfmove = parts.length >= 5 && Number.isInteger(Number(parts[4])) ? Number(parts[4]) : 0
	const fullmove = parts.length >= 6 && Number.isInteger(Number(parts[5])) ? Number(parts[5]) : 1
	return { halfmove, fullmove }
}

/**
 * Build a standard 6-field xiangqi FEN
 */
export const toStandardFen = (
	fen: string,
	sideToMove: Team,
	halfmove: number,
	fullmove: number
): string => {
	const placement = fen.trim().split(/\s+/)[0]
	const side = sideToMove === "red" ? "w" : "b"
	return `${placement} ${side} - - ${halfmove} ${fullmove}`
}

export const fenToBoard = (fen: string): (CellProps | null)[] => {
	// Tolerate both board-only and full 6-field FENs: take the placement field only.
	const rows = fen.trim().split(/\s+/)[0].split("/")
	if (rows.length !== BOARD_ROWS) {
		throw new Error(`Invalid FEN row count: expected ${BOARD_ROWS}, got ${rows.length}`)
	}

	const board: (CellProps | null)[] = []

	for (const rowText of rows) {
		for (const token of rowText) {
			if (token >= "1" && token <= "9") {
				const emptyCount = Number(token)
				for (let i = 0; i < emptyCount; i += 1) {
					board.push(null)
				}
				continue
			}

			const piece = fenPieceMap[token.toLowerCase()]
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

	if (board.length !== BOARD_COLUMNS * BOARD_ROWS) {
		throw new Error(`Invalid FEN board size: expected ${BOARD_COLUMNS * BOARD_ROWS}, got ${board.length}`)
	}

	return board
}

const ATTACKING_PIECES = new Set(["chariot", "horse", "cannon", "soldier"])

/**
 * Whether `team` has at least one attacking piece that has crossed the river.
 * Used for the timeout rule: opponent wins only if they have crossing material, else draw.
 */
export const hasPieceAcrossRiver = (fen: string, team: Team): boolean => {
	const board = fenToBoard(fen)

	let generalRow: number | null = null
	for (const cell of board) {
		if (cell && cell.team === team && cell.piece === "general") {
			generalRow = Math.floor(cell.id / BOARD_COLUMNS)
			break
		}
	}

	// General missing (should not happen in a live game): fall back to the normal
	// "flag = loss" outcome rather than surprising players with a draw.
	if (generalRow === null) {
		return true
	}

	const homeIsTop = generalRow <= 4
	for (const cell of board) {
		if (!cell || cell.team !== team || !ATTACKING_PIECES.has(cell.piece)) {
			continue
		}
		const row = Math.floor(cell.id / BOARD_COLUMNS)
		const crossed = homeIsTop ? row >= 5 : row <= 4
		if (crossed) {
			return true
		}
	}

	return false
}

/**
 * Check if the specified team has any attacking pieces (can cross river) on the board.
 * @param fen the FEN string representing the board state
 * @param team the team to check for attacking pieces ("red" or "black")
 * @returns true if the team has at least one attacking piece, false otherwise
 */
export const hasAttackingMaterial = (fen: string, team: Team): boolean => {
	const board = fenToBoard(fen)
	for (const cell of board) {
		if (cell && cell.team === team && ATTACKING_PIECES.has(cell.piece)) {
			return true
		}
	}
	return false
}

/**
 * Check if the previous move is a forward soldier advance.
 * Sideways soldier moves return false.
 */
export const isSoldierAdvance = (prevFen: string, newFen: string, team: Team): boolean => {
	const prev = fenToBoard(prevFen)
	const next = fenToBoard(newFen)

	// Orientation: the side whose general sits in the top half advances toward higher rows.
	let generalRow: number | null = null
	for (const cell of next) {
		if (cell && cell.team === team && cell.piece === "general") {
			generalRow = Math.floor(cell.id / BOARD_COLUMNS)
			break
		}
	}
	if (generalRow === null) {
		return false
	}
	const forwardSign = generalRow <= 4 ? 1 : -1

	const isTeamSoldier = (cell: CellProps | null): boolean =>
		cell !== null && cell.team === team && cell.piece === "soldier"

	// Exactly one of the team's soldiers changes squares on a soldier move: it leaves
	// `fromRow` and lands on `toRow`.
	let fromRow: number | null = null
	let toRow: number | null = null
	for (let i = 0; i < prev.length; i += 1) {
		const wasSoldier = isTeamSoldier(prev[i])
		const isSoldier = isTeamSoldier(next[i])
		if (wasSoldier && !isSoldier) {
			fromRow = Math.floor(i / BOARD_COLUMNS)
		} else if (!wasSoldier && isSoldier) {
			toRow = Math.floor(i / BOARD_COLUMNS)
		}
	}

	if (fromRow === null || toRow === null) {
		return false
	}
	return forwardSign * (toRow - fromRow) > 0
}

export const boardToFen = (board: (CellProps | null)[]): string => {
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
