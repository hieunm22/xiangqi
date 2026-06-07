import { EmptyPromise, EmptyVoid } from "types/Common"
import { GameInfo } from "types/Entities"
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
	$myTeam?: Team | null
	$previousMove?: boolean

	$animateEnd?: EmptyVoid
	$click?: EmptyVoid
}

export interface PlayerInfoCardProps {
	username?: string
	team: Team
	active: boolean
	avatarUrl?: string | null
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
	pve_mode: boolean
}

export interface RoomInfoData {
	room: RoomInfo
	users: RoomUser[]
	game: GameInfo | null
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
	_id: string
	game_id: string
	fen: string
	team: Team | null
	time_stamp: number
	undo?: number
	capture?: string | null
	captured?: CapturedPieces | null
	userId?: number
}

export interface RoomActionButton {
	key: string
	icon: string
	label: string
	visible: boolean
	enabled: boolean
	onClick: EmptyPromise | EmptyVoid
}

export interface DrawRequest {
	roomId: string | number
	gameId: string
	requestUserId: number
}

export interface MoveProps {
	from: number
	to: number
}

export interface RemoteMoveProps extends MoveProps { 
	fen: string
	isCapture: boolean
}

export interface PieceSideUser {
	top: RoomUser
	bottom: RoomUser
}

export interface RoomSettingsDialogContextValue {
	isOpen: boolean
	isHost: boolean
	room: RoomInfo | null
	users: RoomUser[]
	openSettings: EmptyVoid
	closeSettings: EmptyVoid
	handleSettingsSaved: (newName: string) => void
}

export type SettingsButtonProps = RoomSettingsDialogContextValue

export interface StartGameBody {
	roomId: string | number
	gameId?: string
	status?: number
	bot_difficulty?: number | null
}
