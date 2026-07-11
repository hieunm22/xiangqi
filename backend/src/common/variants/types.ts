// Game-variant abstraction. Everything that differs between xiangqi and chess is
// declared here as data + a couple of small strategy functions

export type GameType = "xiangqi" | "chess"

export interface InitialPosition {
	fen: string
	/** Which team is on the move in the initial position. */
	firstTeam: string
}

export interface VariantConfig {
	gameType: GameType

	/** Board dimensions, used by FEN <-> board conversion. */
	boardRows: number
	boardCols: number

	/**
	 * The two seats, in move order: `teams[0]` moves first in the default setup.
	 * Kept as plain strings (not the clock's `Team` union)
	 */
	teams: readonly [string, string]

	/**
	 * Whether the room's `red_first` toggle is meaningful. Xiangqi lets the host
	 * choose which side opens; chess always starts with white
	 */
	appliesRedFirst: boolean

	/** Whether this variant currently supports playing against the bot. */
	pveSupported: boolean

	/** Resolve the opening position, honoring `red_first` when it applies. */
	getInitialPosition(redFirst: boolean): InitialPosition

	/** Structural check that a submitted FEN matches this variant's board. */
	validateFen(fen: string): boolean

	/**
	 * On a flag-fall (a player runs out of time), whether `winnerTeam` still has
	 * enough material to win. `false` => the time-out is scored as a draw.
	 *   - xiangqi: opponent needs attacking material across the river.
	 *   - chess:   opponent needs sufficient mating material (FIDE Art. 6.9).
	 */
	flagResolver(fen: string, winnerTeam: string): boolean

	/**
	 * Normalize a captured piece token to the case the persisted FEN uses for the
	 * captured (opponent) side, given who captured it. Xiangqi's dialect uses
	 * lowercase for red; standard chess FEN uses uppercase for white
	 */
	formatCapturedPiece(piece: string, capturingTeam: string): string
}
