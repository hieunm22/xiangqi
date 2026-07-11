import { GameType } from "common/variants"
import { CapturedPieces, NullableCellProps, Team } from "types/GameState"
import { HistoryData } from "../types"

// A RoomEngine encapsulates everything that differs between game variants
// (xiangqi vs chess) so the Room hook and board can stay variant-agnostic: FEN
// <-> board, team vocabulary, move generation, check/mate detection, captured
// grouping, and rendering glyphs. The engine is resolved from room.game_type.

export interface BoardContext {
	redFirst: boolean
	turn: Team
}

export interface AppliedMove {
	board: NullableCellProps[]
	// FEN char of the captured (opponent) piece, or null for a quiet move.
	captured: string | null
}

export interface MoveDiff {
	from: number
	to: number
	isCapture: boolean
}

export interface RoomEngine {
	gameType: GameType
	boardRows: number
	boardCols: number
	totalCells: number
	teams: readonly [Team, Team]
	// Empty board for the post-game / waiting view.
	emptyFen: string

	fenToBoard(fen: string): NullableCellProps[]
	// `activeTeam` is the side to move in the produced FEN (used by chess for the
	// active-colour/castling/en-passant fields; ignored by xiangqi).
	boardToFen(board: NullableCellProps[], activeTeam: Team): string

	teamOf(piece?: string | null): Team | null
	otherTeam(team: Team): Team
	// The team that moves first, given the room's red-first setting.
	firstTurn(redFirst: boolean): Team

	// Legal target indices for the selected piece (self-check filtered where the
	// variant supports it).
	availableMoves(board: NullableCellProps[], selectedId: number | null, ctx: BoardContext): number[]
	applyMove(board: NullableCellProps[], from: number, to: number): AppliedMove
	findCheckingPieces(board: NullableCellProps[], team: Team): number[]
	countLegalMoves(board: NullableCellProps[], team: Team, redFirst: boolean): number

	capturedFromHistory(history: HistoryData[]): CapturedPieces
	emptyCaptured(): CapturedPieces
	symbolOf(piece: string): string

	// Whether capturing this cell immediately ends the game (xiangqi general);
	// chess ends via checkmate instead, so this is false there.
	endsOnCapture(cell: NullableCellProps): boolean
	// From/to for a remote move so the board can animate it; null when the move
	// spans more than two squares (castling, en passant) - the board snaps then.
	diffMove(oldFen: string, newFen: string): MoveDiff | null
}
