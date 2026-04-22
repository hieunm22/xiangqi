import { CellProps, Piece, Team } from "types/GameState"

export interface PieceItemProps {
	$cell: CellProps
	children?: React.ReactNode
	$left: number
	$available: boolean
	$selectedId: number | null
	$top: number
	$turn: Team

	$animateEnd?: () => void
	$click?: () => void
}

export interface PlayerInfoCardProps {
	username: string
	team: Team
	capturedPieces: Piece[]
	mirrored?: boolean
}
