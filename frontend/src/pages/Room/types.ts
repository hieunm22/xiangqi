import { MouseEvent } from "react"
import { RoomChatMessage } from "components/ChatDialog/types"
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
	user: RoomUser | null
	team: Team
	active: boolean
	roomHostId: number | null
}

export interface RoomUser {
	id: number
	display_name: string
	avatar_url: string | null
	team: Team | null
	total_points: number
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

interface RoomChatInfo {
	unread_count: number
}

export interface RoomInfoData {
	room: RoomInfo
	users: RoomUser[]
	game: GameInfo | null
	chat: RoomChatInfo
}

export interface RoomWithUsers {
	room: RoomInfo
	users: RoomUser[]
}

export interface GameMovements {
	_id: string
	game_id: string
	team: Team
	fen: string
	time_stamp: number
	capture?: PieceCharacter
	surrender?: number
	undo?: number
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

export interface GameMenuActionContextValue {
	actionMenuItems: RoomActionButton[]
	isActionMenuOpen: boolean
	menuAnchorEl: HTMLElement | null

	closeActionMenu: EmptyVoid
	handleMenuItemClick: (onClick: EmptyVoid) => () => void
	openActionMenu: (e: MouseEvent<HTMLButtonElement>) => void
}

export interface RoomChatDialogContextValue {
	open: boolean
	incomingMessage: RoomChatMessage | null
	roomId: number
	roomName: string
	pveMode: boolean
	unreadCount: number
	openChat: EmptyVoid
	onClose: EmptyVoid
}

export type RoomChatButtonProps = RoomChatDialogContextValue

export interface RoomSettingsDialogContextValue {
	isOpen: boolean
	isHost: boolean
	room: RoomInfo | null
	users: RoomUser[]
	game: GameInfo | null
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
