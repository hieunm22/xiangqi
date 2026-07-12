import { groupCaptures } from "./shared"
import {
	applyChessMove,
	boardToChessFen,
	ChessTeam,
	chessCountLegalMoves,
	chessFenToBoard,
	chessFindCheckingPieces,
	chessIconClass,
	chessLegalTargets,
	teamOfChar
} from "../variants/chess"
import { CapturedPieces, Team } from "types/GameState"
import { HistoryData } from "../types"
import { AppliedMove, MoveDiff, RoomEngine } from "./types"

const TEAMS: readonly [Team, Team] = ["white", "black"]
const EMPTY_CHESS_FEN = "8/8/8/8/8/8/8/8"

const asChessTeam = (team: Team): ChessTeam => (team === "black" ? "black" : "white")

/** Parse a chess FEN placement into a 64-cell char array (metadata ignored). */
function placementCells(fen: string): (string | null)[] {
	const placement = fen.trim().split(/\s+/)[0]
	const cells: (string | null)[] = []
	for (const rowText of placement.split("/")) {
		for (const token of rowText) {
			if (token >= "1" && token <= "8") {
				for (let i = 0; i < Number(token); i += 1) cells.push(null)
			} else {
				cells.push(token)
			}
		}
	}
	return cells
}

/** Chess engine - full legal rules (self-check filtered, castling, en passant,
 * auto-queen promotion) mirroring the backend chess evaluator. */
export const chessEngine: RoomEngine = {
	gameType: "chess",
	boardRows: 8,
	boardCols: 8,
	totalCells: 64,
	teams: TEAMS,
	emptyFen: EMPTY_CHESS_FEN,

	fenToBoard: chessFenToBoard,
	boardToFen: (board, activeTeam) => boardToChessFen(board, asChessTeam(activeTeam)),

	teamOf: teamOfChar,
	otherTeam: team => (team === "white" ? "black" : "white"),
	// Chess always opens with white regardless of the red-first toggle.
	firstTurn: () => "white",

	availableMoves(board, selectedId) {
		return chessLegalTargets(board, selectedId)
	},

	applyMove(board, from, to): AppliedMove {
		return applyChessMove(board, from, to)
	},

	findCheckingPieces(board, team) {
		return chessFindCheckingPieces(board, asChessTeam(team))
	},

	countLegalMoves(board, team) {
		return chessCountLegalMoves(board, asChessTeam(team))
	},

	capturedFromHistory(history: HistoryData[]): CapturedPieces {
		return groupCaptures(history, this.teamOf, this.otherTeam)
	},

	emptyCaptured: () => ({ white: [], black: [] }),

	coMoves(board, from, to) {
		if (board[from]?.piece?.toLowerCase() !== "k") return []
		if (Math.floor(from / 8) !== Math.floor(to / 8)) return []
		if (to - from === 2) return [{ from: from + 3, to: from + 1 }] // kingside: h-rook -> f
		if (to - from === -2) return [{ from: from - 4, to: from - 1 }] // queenside: a-rook -> d
		return []
	},

	symbolOf: chessIconClass,

	// Kings are never captured in legal chess; the game ends via checkmate.
	endsOnCapture: () => false,

	diffMove(oldFen, newFen): MoveDiff | null {
		const before = placementCells(oldFen)
		const after = placementCells(newFen)
		const changed: number[] = []
		for (let i = 0; i < before.length; i += 1) {
			if (before[i] !== after[i]) changed.push(i)
		}
		// Castling (4 squares) and en passant (3) can't be shown as a single slide.
		if (changed.length !== 2) return null

		const [a, b] = changed
		// The origin square is the one that became empty.
		if (before[a] && !after[a] && after[b] === before[a]) {
			return { from: a, to: b, isCapture: before[b] !== null }
		}
		if (before[b] && !after[b] && after[a] === before[b]) {
			return { from: b, to: a, isCapture: before[a] !== null }
		}
		return null
	}
}
