export interface GameState {
	board: (CellProps | null)[]
	selected: CellProps | null
	availableMoves: number[]
	teamTurn: Team | null
	capturedPieces: {
		white: Piece[]
		black: Piece[]
	}
}

export interface CellProps {
	id: number
	piece: Piece
	team: Team
	animateTo?: number
	canBeEnPassant?: boolean
}

export type Team = "white" | "black"

export type Piece = "pawn" | "knight" | "bishop" | "rook" | "queen" | "king"
