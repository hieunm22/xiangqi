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
	avatarUrl?: string | null
	mirrored?: boolean
	isEmpty?: boolean
}

export interface JoinedUser {
	id: number
	display_name: string
	avatar_url: string | null
	team: Team | null
}
