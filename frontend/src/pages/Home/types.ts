import { EmptyVoid } from "types/Common"
import { CellProps, Piece, Team } from "types/GameState"

export interface PieceItemProps {
	$cell: CellProps
	children?: React.ReactNode
	$left: number
	$available: boolean
	$selectedId: number | null
	$top: number
	$turn: Team

	$animateEnd?: EmptyVoid
	$click?: EmptyVoid
}

export interface PlayerInfoCardProps {
	username: string
	team: Team
	capturedPieces: Piece[]
	mirrored?: boolean
}
