import { CellProps, NullableCellProps } from "types/GameState"

// Frontend chess rules, char-based and mirroring the backend chess evaluator.
// Operates directly on the shared board (`CellProps.piece` = a FEN letter,
// uppercase = white, lowercase = black). Board index 0 = a8 (top-left),
// 63 = h1 (bottom-right). FEN stores placement only; transient rights are
// inferred from board cell flags when available.

export type ChessTeam = "white" | "black"

// Font Awesome (Pro) chess icons. One icon per piece type; the team colour is
// applied via CSS, so case only matters for team detection, not the icon.
const PIECE_ICON: Record<string, string> = {
	k: "fa-chess-king",
	q: "fa-chess-queen",
	r: "fa-chess-rook",
	b: "fa-chess-bishop",
	n: "fa-chess-knight",
	p: "fa-chess-pawn"
}

export const CHESS_TOTAL_CELLS = 64

const KNIGHT_OFFSETS: Array<[number, number]> =
	[[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]]

const fileOf = (index: number) => index % 8
const rankOf = (index: number) => Math.floor(index / 8)
const onBoard = (index: number) => index >= 0 && index < 64

export function teamOfChar(piece?: string | null): ChessTeam | null {
	if (!piece) return null
	return piece === piece.toUpperCase() ? "white" : "black"
}

export function otherChessTeam(team: ChessTeam): ChessTeam {
	return team === "white" ? "black" : "white"
}

/** Font Awesome class for a chess FEN char, e.g. "fas fa-chess-king". */
export function chessIconClass(piece: string): string {
	const icon = PIECE_ICON[piece.toLowerCase()]
	return icon ? `fas ${icon}` : ""
}

const teamOfCell = (cell: NullableCellProps): ChessTeam | null => teamOfChar(cell?.piece)

/** Parse a board-only chess FEN into the 64-cell board. */
export function chessFenToBoard(fen: string): CellProps[] {
	const placement = fen.trim().split(/\s+/)[0]
	const rows = placement.split("/")
	if (rows.length !== 8) {
		throw new Error(`Invalid chess FEN: expected 8 ranks, got ${rows.length}`)
	}

	const board: CellProps[] = []
	for (const rowText of rows) {
		let colCount = 0
		for (const token of rowText) {
			if (token >= "1" && token <= "8") {
				const gap = Number(token)
				for (let i = 0; i < gap; i += 1) board.push({ id: board.length, piece: null })
				colCount += gap
				continue
			}
			if (!"pnbrqkPNBRQK".includes(token)) {
				throw new Error(`Invalid chess FEN piece token: '${token}'`)
			}
			board.push({ id: board.length, piece: token })
			colCount += 1
		}
		if (colCount !== 8) {
			throw new Error("Invalid chess FEN: a rank does not describe 8 squares")
		}
	}

	return board
}
/** Serialize the board to board-only chess FEN placement. */
export function boardToChessFen(board: NullableCellProps[], activeTeam: ChessTeam): string {
	const rows: string[] = []
	for (let row = 0; row < 8; row += 1) {
		let rowFen = ""
		let empty = 0
		for (let col = 0; col < 8; col += 1) {
			const cell = board[row * 8 + col]
			if (!cell || !cell.piece) {
				empty += 1
				continue
			}
			if (empty > 0) { rowFen += String(empty); empty = 0 }
			rowFen += cell.piece
		}
		if (empty > 0) rowFen += String(empty)
		rows.push(rowFen)
	}

	void activeTeam
	return rows.join("/")
}

function isPathClear(board: NullableCellProps[], from: number, to: number): boolean {
	const stepFile = Math.sign(fileOf(to) - fileOf(from))
	const stepRank = Math.sign(rankOf(to) - rankOf(from))
	const step = stepRank * 8 + stepFile
	let cur = from + step
	while (cur !== to) {
		if (!onBoard(cur) || board[cur]?.piece) return false
		cur += step
	}
	return true
}

/** True if `target` is attacked by any piece of `byTeam`. */
function isSquareAttacked(board: NullableCellProps[], target: number, byTeam: ChessTeam): boolean {
	const tf = fileOf(target)
	const tr = rankOf(target)

	for (let i = 0; i < 64; i += 1) {
		const cell = board[i]
		if (!cell?.piece || teamOfChar(cell.piece) !== byTeam) continue

		const piece = cell.piece.toLowerCase()
		const df = tf - fileOf(i)
		const dr = tr - rankOf(i)
		const adf = Math.abs(df)
		const adr = Math.abs(dr)

		switch (piece) {
			case "p": {
				const forward = byTeam === "white" ? -1 : 1
				if (dr === forward && adf === 1) return true
				break
			}
			case "n":
				if ((adf === 1 && adr === 2) || (adf === 2 && adr === 1)) return true
				break
			case "k":
				if (adf <= 1 && adr <= 1 && (adf !== 0 || adr !== 0)) return true
				break
			case "b":
				if (adf === adr && adf > 0 && isPathClear(board, i, target)) return true
				break
			case "r":
				if ((df === 0 || dr === 0) && adf + adr > 0 && isPathClear(board, i, target)) return true
				break
			case "q":
				if (((adf === adr && adf > 0) || ((df === 0 || dr === 0) && adf + adr > 0))
					&& isPathClear(board, i, target)) {
					return true
				}
				break
			default:
				break
		}
	}
	return false
}

function kingIndex(board: NullableCellProps[], team: ChessTeam): number {
	return board.findIndex(cell =>
		cell?.piece?.toLowerCase() === "k" && teamOfChar(cell.piece) === team)
}

interface RawMove {
	to: number
	rookFrom?: number
	rookTo?: number
	enPassantCapture?: number
}

/** Pseudo-legal moves from `from` (no self-check filter). */
function pseudoMoves(board: NullableCellProps[], from: number): RawMove[] {
	const cell = board[from]
	if (!cell?.piece) return []
	const team = teamOfChar(cell.piece)!
	const piece = cell.piece.toLowerCase()
	const moves: RawMove[] = []
	const f = fileOf(from)
	const r = rankOf(from)

	const pushIfEnemyOrEmpty = (to: number) => {
		if (!onBoard(to)) return
		const t = board[to]
		if (!t?.piece || teamOfChar(t.piece) !== team) moves.push({ to })
	}

	const slide = (steps: Array<[number, number]>) => {
		for (const [sf, sr] of steps) {
			let cf = f + sf
			let cr = r + sr
			while (cf >= 0 && cf < 8 && cr >= 0 && cr < 8) {
				const to = cr * 8 + cf
				const t = board[to]
				if (!t?.piece) {
					moves.push({ to })
				} else {
					if (teamOfChar(t.piece) !== team) moves.push({ to })
					break
				}
				cf += sf
				cr += sr
			}
		}
	}

	switch (piece) {
		case "p": {
			const forward = team === "white" ? -1 : 1
			const startRank = team === "white" ? 6 : 1
			const oneAhead = from + forward * 8
			if (onBoard(oneAhead) && !board[oneAhead]?.piece) {
				moves.push({ to: oneAhead })
				const twoAhead = from + forward * 16
				if (r === startRank && !board[twoAhead]?.piece) moves.push({ to: twoAhead })
			}
			for (const sf of [-1, 1]) {
				const cf = f + sf
				const cr = r + forward
				if (cf < 0 || cf > 7 || cr < 0 || cr > 7) continue
				const to = cr * 8 + cf
				const t = board[to]
				if (t?.piece && teamOfChar(t.piece) !== team) {
					moves.push({ to })
				} else if (!t?.piece) {
					// En passant: an adjacent enemy pawn flagged canBeEnPassant.
					const sideCell = board[r * 8 + cf]
					if (sideCell?.canBeEnPassant && sideCell.piece?.toLowerCase() === "p"
						&& teamOfChar(sideCell.piece) !== team) {
						moves.push({ to, enPassantCapture: r * 8 + cf })
					}
				}
			}
			break
		}
		case "n":
			for (const [sf, sr] of KNIGHT_OFFSETS) {
				const cf = f + sf
				const cr = r + sr
				if (cf < 0 || cf > 7 || cr < 0 || cr > 7) continue
				pushIfEnemyOrEmpty(cr * 8 + cf)
			}
			break
		case "b":
			slide([[1, 1], [1, -1], [-1, 1], [-1, -1]])
			break
		case "r":
			slide([[1, 0], [-1, 0], [0, 1], [0, -1]])
			break
		case "q":
			slide([[1, 1], [1, -1], [-1, 1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]])
			break
		case "k":
			for (const sf of [-1, 0, 1]) {
				for (const sr of [-1, 0, 1]) {
					if (sf === 0 && sr === 0) continue
					const cf = f + sf
					const cr = r + sr
					if (cf < 0 || cf > 7 || cr < 0 || cr > 7) continue
					pushIfEnemyOrEmpty(cr * 8 + cf)
				}
			}
			moves.push(...castlingMoves(board, from, team))
			break
		default:
			break
	}

	return moves
}

function castlingMoves(board: NullableCellProps[], from: number, team: ChessTeam): RawMove[] {
	const moves: RawMove[] = []
	const homeKing = team === "white" ? 60 : 4
	if (from !== homeKing) return moves
	const king = board[homeKing]
	if (!king?.piece || king.piece.toLowerCase() !== "k" || king.hasMoved) return moves
	const enemy = otherChessTeam(team)
	if (isSquareAttacked(board, homeKing, enemy)) return moves

	const rookUnmoved = (index: number) => {
		const cell = board[index]
		return cell?.piece?.toLowerCase() === "r" && teamOfChar(cell.piece) === team && !cell.hasMoved
	}

	// Kingside.
	const kRook = homeKing + 3
	const f1 = homeKing + 1
	const g1 = homeKing + 2
	if (rookUnmoved(kRook) && !board[f1]?.piece && !board[g1]?.piece
		&& !isSquareAttacked(board, f1, enemy) && !isSquareAttacked(board, g1, enemy)) {
		moves.push({ to: g1, rookFrom: kRook, rookTo: f1 })
	}

	// Queenside.
	const qRook = homeKing - 4
	const d1 = homeKing - 1
	const c1 = homeKing - 2
	const b1 = homeKing - 3
	if (rookUnmoved(qRook) && !board[d1]?.piece && !board[c1]?.piece && !board[b1]?.piece
		&& !isSquareAttacked(board, d1, enemy) && !isSquareAttacked(board, c1, enemy)) {
		moves.push({ to: c1, rookFrom: qRook, rookTo: d1 })
	}

	return moves
}

function cloneBoard(board: NullableCellProps[]): CellProps[] {
	return board.map((cell, id) => cell ? { ...cell, id } : { id, piece: null })
}

/** Apply a raw move to a fresh board, handling castling/en-passant/promotion and flags. */
function commitMove(board: NullableCellProps[], from: number, move: RawMove): {
	board: CellProps[]
	captured: string | null
} {
	const next = cloneBoard(board)
	const moving = next[from]
	const movingPiece = moving.piece!
	const team = teamOfChar(movingPiece)!
	const lower = movingPiece.toLowerCase()

	let captured: string | null = next[move.to].piece
	// Clear every en-passant flag; only the pawn that double-steps this move re-sets it.
	for (const cell of next) cell.canBeEnPassant = false

	next[move.to] = {
		...moving,
		id: move.to,
		animateTo: undefined,
		hasMoved: undefined,
		canBeEnPassant: undefined
	}
	next[from] = { id: from, piece: null }

	if (move.enPassantCapture !== undefined) {
		captured = next[move.enPassantCapture].piece
		next[move.enPassantCapture] = { id: move.enPassantCapture, piece: null }
	}

	if (move.rookFrom !== undefined && move.rookTo !== undefined) {
		const rook = next[move.rookFrom]
		next[move.rookTo] = { ...rook, id: move.rookTo, hasMoved: true, animateTo: undefined }
		next[move.rookFrom] = { id: move.rookFrom, piece: null }
	}

	// King/rook lose castling rights once they move.
	if (lower === "k" || lower === "r") next[move.to].hasMoved = true

	// Pawn double-step arms en passant; promotion auto-queens.
	if (lower === "p") {
		if (Math.abs(rankOf(move.to) - rankOf(from)) === 2) {
			next[move.to].canBeEnPassant = true
		}
		const landRank = rankOf(move.to)
		if (landRank === 0 || landRank === 7) {
			next[move.to].piece = team === "white" ? "Q" : "q"
		}
	}

	return { board: next, captured }
}

/** Fully-legal target indices for the piece at `selectedId` (self-check filtered). */
export function chessLegalTargets(board: NullableCellProps[], selectedId: number | null): number[] {
	if (selectedId === null) return []
	const cell = board[selectedId]
	if (!cell?.piece) return []
	const team = teamOfChar(cell.piece)!
	const enemy = otherChessTeam(team)

	const targets: number[] = []
	for (const move of pseudoMoves(board, selectedId)) {
		const { board: next } = commitMove(board, selectedId, move)
		const king = kingIndex(next, team)
		if (king >= 0 && !isSquareAttacked(next, king, enemy)) {
			targets.push(move.to)
		}
	}
	return targets.sort((a, b) => a - b)
}

/**
 * Apply the player's chosen move (from -> to). Infers castling/en-passant/
 * promotion from geometry. Returns the next board and any captured FEN char.
 */
export function applyChessMove(board: NullableCellProps[], from: number, to: number): {
	board: CellProps[]
	captured: string | null
} {
	const move = pseudoMoves(board, from).find(m => m.to === to) ?? { to }
	return commitMove(board, from, move)
}

/** Enemy pieces currently attacking `team`'s king (for the check highlight). */
export function chessFindCheckingPieces(board: NullableCellProps[], team: ChessTeam): number[] {
	const king = kingIndex(board, team)
	if (king < 0) return []
	const enemy = otherChessTeam(team)
	const checkers: number[] = []
	for (let i = 0; i < 64; i += 1) {
		const cell = board[i]
		if (!cell?.piece || teamOfChar(cell.piece) !== enemy) continue
		if (pseudoMoves(board, i).some(m => m.to === king)) checkers.push(i)
	}
	return checkers
}

/** Count of fully-legal moves available to `team` (0 => mate or stalemate). */
export function chessCountLegalMoves(board: NullableCellProps[], team: ChessTeam): number {
	let count = 0
	for (let from = 0; from < 64; from += 1) {
		const cell = board[from]
		if (!cell?.piece || teamOfChar(cell.piece) !== team) continue
		count += chessLegalTargets(board, from).length
	}
	return count
}

export { teamOfCell }
