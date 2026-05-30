export type NullableCellProps = CellProps | null

export interface CapturedPieces {
	red: PieceCharacter[]
	black: PieceCharacter[]
}

export interface CellProps {
	id: number
	piece: PieceCharacter | null
	animateTo?: number
}

export type Team = "red" | "black"

export type Piece = "general"
	| "advisor"
	| "elephant"
	| "horse"
	| "chariot"
	| "cannon"
	| "soldier"

export type PieceCharacter =
	"g" | "a" | "e" | "h" | "r" | "c" | "s"
	| "G" | "A" | "E" | "H" | "R" | "C" | "S"
