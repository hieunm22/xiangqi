export type NullableCellProps = CellProps | null

// Captured pieces grouped by the owning team.
export type CapturedPieces = Partial<Record<Team, string[]>>

export interface CellProps {
	id: number
	piece: string | null
	animateTo?: number

	// Chess-only positional flags
	canBeEnPassant?: boolean
	hasMoved?: boolean
}

export type Team = "red" | "black" | "white"

// xiangqi
export type Piece = "general"
	| "advisor"
	| "elephant"
	| "horse"
	| "chariot"
	| "cannon"
	| "soldier"

export type XiangqiPieceCharacter =
	"g" | "a" | "e" | "h" | "r" | "c" | "s"
	| "G" | "A" | "E" | "H" | "R" | "C" | "S"
