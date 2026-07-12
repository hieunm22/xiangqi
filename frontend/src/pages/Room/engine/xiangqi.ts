import { CapturedPieces, Team, XiangqiPieceCharacter } from "types/GameState"
import { EMPTY_BOARD_FEN, pieceSymbolByType } from "../variants/xiangqi/constants"
import {
	applyMove,
	boardToFen,
	countLegalMoves,
	diffFenMove,
	fenToBoard,
	findCheckingPieces,
	getAvailableMoves,
	getMoveDirection,
	getPieceFromCharacter,
	getTeamFromPieceChar
} from "../variants/xiangqi/rules"
import { HistoryData } from "../types"
import { AppliedMove, BoardContext, MoveDiff, RoomEngine } from "./types"
import { groupCaptures } from "./shared"

const TEAMS: readonly [Team, Team] = ["red", "black"]

/** Xiangqi engine - a thin adapter over variants/xiangqi/rules.ts, mirroring the
 * chess engine, so the classic game routes through RoomEngine unchanged. */
export const xiangqiEngine: RoomEngine = {
	gameType: "xiangqi",
	boardRows: 10,
	boardCols: 9,
	totalCells: 90,
	teams: TEAMS,
	emptyFen: EMPTY_BOARD_FEN,

	fenToBoard,
	boardToFen: board => boardToFen(board),

	teamOf: getTeamFromPieceChar,
	otherTeam: team => (team === "red" ? "black" : "red"),
	firstTurn: redFirst => (redFirst ? "red" : "black"),

	availableMoves(board, selectedId, ctx: BoardContext) {
		const direction = getMoveDirection(ctx.redFirst, ctx.turn)
		return getAvailableMoves(board, selectedId, direction)
	},

	applyMove(board, from, to): AppliedMove {
		// Available moves only target empty or enemy cells, so any occupant is a capture.
		const captured = board[to]?.piece ?? null
		return { board: applyMove(board, from, to), captured }
	},

	findCheckingPieces(board, team) {
		return findCheckingPieces(board, team)
	},

	countLegalMoves(board, team, redFirst) {
		return countLegalMoves(board, team, redFirst)
	},

	capturedFromHistory(history: HistoryData[]): CapturedPieces {
		return groupCaptures(history, this.teamOf, this.otherTeam)
	},

	emptyCaptured: () => ({ red: [], black: [] }),

	// Xiangqi has no companion-piece moves (no castling).
	coMoves: () => [],

	symbolOf: piece => pieceSymbolByType[piece as XiangqiPieceCharacter] ?? "",

	endsOnCapture: cell => getPieceFromCharacter(cell?.piece) === "general",

	diffMove(oldFen, newFen): MoveDiff | null {
		const diff = diffFenMove(oldFen, newFen)
		if (!diff) return null
		return { from: diff.oldIndex, to: diff.newIndex, isCapture: diff.capturedCell !== null }
	}
}
