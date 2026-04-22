export interface GameState {
	board: (CellProps | null)[]
	selected: number | null
	availableMoves: number[]
	teamTurn: Team
	capturedPieces: {
		red: Piece[]
		black: Piece[]
	}
}

export interface CellProps {
	id: number
	piece: Piece
	team: Team
	animateTo?: number
}

export type Team = "red" | "black"

export type Piece = "general" | "advisor" | "elephant" | "horse" | "chariot" | "cannon" | "soldier"
