import { GameStateStatus } from "types/game.type"

// Server-side chess rules, mirroring the frontend legal-move layer.
// uppercase FEN letters are white, lowercase are black.

type ChessTeam = "white" | "black"
type ChessPiece = "p" | "n" | "b" | "r" | "q" | "k"

interface ChessCell {
	piece: ChessPiece
	team: ChessTeam
}

interface ChessPosition {
	board: (ChessCell | null)[]
}

interface TeamStateEvaluation {
	inCheck: boolean
	legalMovesCount: number
	status: GameStateStatus
}

interface ChessMove {
	from: number
	to: number
	// Rook relocation when castling (kingside/queenside), else undefined.
	rookFrom?: number
	rookTo?: number
	// Square of a pawn captured en passant, else undefined.
	enPassantCapture?: number
}

const fileOf = (index: number) => index % 8
const rankOf = (index: number) => Math.floor(index / 8)
const onBoard = (index: number) => index >= 0 && index < 64
const other = (team: ChessTeam): ChessTeam => (team === "white" ? "black" : "white")

/** Parse a board-only chess FEN (placement ranks only) into a position. */
export function parseChessFen(fen: string): ChessPosition {
	const placement = fen.trim().split(/\s+/)[0]
	const rows = placement.split("/")
	if (rows.length !== 8) {
		throw new Error(`Invalid chess FEN: expected 8 ranks, got ${rows.length}`)
	}

	const board: (ChessCell | null)[] = []
	for (const rowText of rows) {
		let colCount = 0
		for (const token of rowText) {
			if (token >= "1" && token <= "8") {
				const gap = Number(token)
				for (let i = 0; i < gap; i += 1) board.push(null)
				colCount += gap
				continue
			}
			const lower = token.toLowerCase()
			if (!"pnbrqk".includes(lower)) {
				throw new Error(`Invalid chess FEN piece token: '${token}'`)
			}
			board.push({
				piece: lower as ChessPiece,
				team: token === token.toUpperCase() ? "white" : "black"
			})
			colCount += 1
		}
		if (colCount !== 8) {
			throw new Error("Invalid chess FEN: a rank does not describe 8 squares")
		}
	}

	return { board }
}

/** True if `target` is attacked by any piece of `byTeam` (ignores pins/check). */
function isSquareAttacked(board: (ChessCell | null)[], target: number, byTeam: ChessTeam): boolean {
	const tf = fileOf(target)
	const tr = rankOf(target)

	for (let i = 0; i < 64; i += 1) {
		const cell = board[i]
		if (!cell || cell.team !== byTeam) continue

		const f = fileOf(i)
		const r = rankOf(i)
		const df = tf - f
		const dr = tr - r
		const adf = Math.abs(df)
		const adr = Math.abs(dr)

		switch (cell.piece) {
			case "p": {
				// White pawns attack toward rank 8 (upward, dr = -1); black toward rank 1 (dr = +1).
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
				if ((df === 0 || dr === 0) && (adf + adr) > 0 && isPathClear(board, i, target)) return true
				break
			case "q":
				if (((adf === adr && adf > 0) || ((df === 0 || dr === 0) && (adf + adr) > 0))
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

/** True if all squares strictly between `from` and `to` (a straight/diagonal line) are empty. */
function isPathClear(board: (ChessCell | null)[], from: number, to: number): boolean {
	const stepFile = Math.sign(fileOf(to) - fileOf(from))
	const stepRank = Math.sign(rankOf(to) - rankOf(from))
	const step = stepRank * 8 + stepFile
	let cur = from + step
	while (cur !== to) {
		if (!onBoard(cur) || board[cur]) return false
		cur += step
	}
	return true
}

function kingIndex(board: (ChessCell | null)[], team: ChessTeam): number {
	return board.findIndex(cell => cell?.piece === "k" && cell.team === team)
}

/** Pseudo-legal moves for the piece at `from` (does not filter self-check). */
function pseudoMoves(position: ChessPosition, from: number): ChessMove[] {
	const { board } = position
	const cell = board[from]
	if (!cell) return []
	const team = cell.team
	const moves: ChessMove[] = []
	const f = fileOf(from)
	const r = rankOf(from)

	const pushIfEnemyOrEmpty = (to: number) => {
		if (!onBoard(to)) return
		const t = board[to]
		if (!t || t.team !== team) moves.push({ from, to })
	}

	const slide = (steps: Array<[number, number]>) => {
		for (const [sf, sr] of steps) {
			let cf = f + sf
			let cr = r + sr
			while (cf >= 0 && cf < 8 && cr >= 0 && cr < 8) {
				const to = cr * 8 + cf
				const t = board[to]
				if (!t) {
					moves.push({ from, to })
				} else {
					if (t.team !== team) moves.push({ from, to })
					break
				}
				cf += sf
				cr += sr
			}
		}
	}

	switch (cell.piece) {
		case "p": {
			const forward = team === "white" ? -1 : 1
			const startRank = team === "white" ? 6 : 1
			const oneAhead = from + forward * 8
			if (onBoard(oneAhead) && !board[oneAhead]) {
				moves.push({ from, to: oneAhead })
				const twoAhead = from + forward * 16
				if (r === startRank && !board[twoAhead]) moves.push({ from, to: twoAhead })
			}
			for (const sf of [-1, 1]) {
				const cf = f + sf
				const cr = r + forward
				if (cf < 0 || cf > 7 || cr < 0 || cr > 7) continue
				const to = cr * 8 + cf
				const t = board[to]
				if (t && t.team !== team) {
					moves.push({ from, to })
				}
			}
			break
		}
		case "n": {
			for (const [sf, sr] of [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]]) {
				const cf = f + sf
				const cr = r + sr
				if (cf < 0 || cf > 7 || cr < 0 || cr > 7) continue
				pushIfEnemyOrEmpty(cr * 8 + cf)
			}
			break
		}
		case "b":
			slide([[1, 1], [1, -1], [-1, 1], [-1, -1]])
			break
		case "r":
			slide([[1, 0], [-1, 0], [0, 1], [0, -1]])
			break
		case "q":
			slide([[1, 1], [1, -1], [-1, 1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]])
			break
		case "k": {
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
		}
		default:
			break
	}

	return moves
}

/** Castling availability is inferred only from current placement. */
function castlingMoves(board: (ChessCell | null)[], from: number, team: ChessTeam): ChessMove[] {
	const moves: ChessMove[] = []
	const homeKing = team === "white" ? 60 : 4
	if (from !== homeKing) return moves
	if (board[homeKing]?.piece !== "k" || board[homeKing]?.team !== team) return moves
	const enemy = other(team)
	if (isSquareAttacked(board, from, enemy)) return moves

	// Kingside: squares f1/g1 (or f8/g8) empty and not attacked; rook on h-file.
	const rookFromKingSide = homeKing + 3
	const f1 = homeKing + 1
	const g1 = homeKing + 2
	if (!board[f1] && !board[g1]
		&& board[rookFromKingSide]?.piece === "r"
		&& board[rookFromKingSide]?.team === team
		&& !isSquareAttacked(board, f1, enemy)
		&& !isSquareAttacked(board, g1, enemy)) {
		moves.push({ from, to: g1, rookFrom: rookFromKingSide, rookTo: f1 })
	}

	// Queenside: b1/c1/d1 empty; c1/d1 not attacked; rook on a-file.
	const rookFromQueenSide = homeKing - 4
	const d1 = homeKing - 1
	const c1 = homeKing - 2
	const b1 = homeKing - 3
	if (!board[d1] && !board[c1] && !board[b1]
		&& board[rookFromQueenSide]?.piece === "r"
		&& board[rookFromQueenSide]?.team === team
		&& !isSquareAttacked(board, d1, enemy)
		&& !isSquareAttacked(board, c1, enemy)) {
		moves.push({ from, to: c1, rookFrom: rookFromQueenSide, rookTo: d1 })
	}

	return moves
}

/** Apply a move to a fresh board copy (promotion auto-queens). */
function applyMove(board: (ChessCell | null)[], move: ChessMove): (ChessCell | null)[] {
	const next = [...board]
	const moving = next[move.from]!
	next[move.to] = { ...moving }
	next[move.from] = null
	if (move.enPassantCapture !== undefined) next[move.enPassantCapture] = null
	if (move.rookFrom !== undefined && move.rookTo !== undefined) {
		next[move.rookTo] = next[move.rookFrom]
		next[move.rookFrom] = null
	}
	// Auto-promote a pawn reaching the far rank.
	const landRank = rankOf(move.to)
	if (moving.piece === "p" && (landRank === 0 || landRank === 7)) {
		next[move.to] = { piece: "q", team: moving.team }
	}
	return next
}

/** Fully-legal moves for `team` (pseudo-legal filtered by leaving own king safe). */
function legalMoves(position: ChessPosition, team: ChessTeam): ChessMove[] {
	const { board } = position
	const legal: ChessMove[] = []
	const enemy = other(team)

	for (let from = 0; from < 64; from += 1) {
		const cell = board[from]
		if (!cell || cell.team !== team) continue
		for (const move of pseudoMoves(position, from)) {
			const next = applyMove(board, move)
			const king = kingIndex(next, team)
			if (king >= 0 && !isSquareAttacked(next, king, enemy)) {
				legal.push(move)
			}
		}
	}

	return legal
}

/**
 * Evaluate check/checkmate/stalemate for `checkedTeam` given a chess FEN. The
 * FEN's active-colour field is overridden by `checkedTeam` so the evaluation
 * always considers whether that side can respond.
 */
export function evaluateChessTeamState(fen: string, checkedTeam: ChessTeam): TeamStateEvaluation {
	const position = parseChessFen(fen)
	const king = kingIndex(position.board, checkedTeam)
	const inCheck = king >= 0 && isSquareAttacked(position.board, king, other(checkedTeam))
	const legalMovesCount = legalMoves(position, checkedTeam).length

	if (legalMovesCount === 0) {
		return {
			inCheck,
			legalMovesCount,
			status: inCheck ? "checkmate" : "stalemate"
		}
	}

	return {
		inCheck,
		legalMovesCount,
		status: inCheck ? "check" : "ongoing"
	}
}
