import { EmptyVoid } from "types/Common"
import {
	CapturedPieces,
	CellProps,
	PieceCharacter,
	Team
} from "types/GameState"

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
	capturedPieces: PieceCharacter[]
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
	game_id?: string | null
}

export interface RoomInfoResponse {
	success: boolean
	status_code: number
	data: RoomInfoData | null
}

export interface MovePieceRequest {
	gameId: string
	newFen: string
	team: Team
	capturePiece: PieceCharacter | null
}

export interface HistoryData {
	fen: string
	team: Team | null
	time_stamp: number
	capture: string | null
	captured: CapturedPieces | null
}
