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
	userId?: number
}

export interface RoomUser {
	id: number
	display_name: string
	avatar_url: string | null
	team: Team | null
	joined_at: string
}

export interface RoomInfo {
	id: number
	name: string
	status: number
	bet_amount: number
	team: Team | null
	red_first: boolean
}

interface RoomInfoData {
	room: RoomInfo
	users: RoomUser[]
}

export interface RoomInfoResponse {
	success: boolean
	status_code: number
	data: RoomInfoData | null
}
