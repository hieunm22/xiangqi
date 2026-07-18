import { EmptyPromise, EmptyVoid, StringVoid } from "types/Common"
import { GameInfo } from "types/Entities"
import {
	CapturedPieces,
	CellProps,
	PieceCharacter,
	Team
} from "types/GameState"
import { RoomChatMessage } from "components/ChatDialog/types"

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
	$checking?: boolean
	$checkedGeneral?: boolean
	$rotated?: boolean

	$animateEnd?: EmptyVoid
	$click?: EmptyVoid
}

export interface PlayerInfoCardProps {
	user: RoomUser | null
	team: Team
	active: boolean
	botLevel: number | null
	roomHostId: number | null
	roomId: number | null
	remainingMs?: number | null
	perMoveMs?: number | null
	timePerMove?: number
}

export interface ClockSnapshot {
	redMs: number
	blackMs: number
	activeTeam: Team
	perMoveRemainingMs: number
	serverNow: number
	timeLimit: number
	timeIncrement: number
	timePerMove: number
}

export interface RoomUser {
	id: number
	display_name: string
	avatar_url: string | null
	back_ready: boolean | null
	team: Team | null
	total_amount: number
	is_bot: boolean
}

export interface BackToRoomRequest {
	roomId: number
	gameId: string
}

export interface RoomInfo {
	id: number
	name: string
	status: number
	game_type: string
	bet_amount: number
	team: Team | null
	red_first: boolean
	pve_mode: boolean
	host_id: number | null
	time_limit: number | null
	time_increment?: number
	time_per_move?: number
}

interface RoomChatInfo {
	unread_count: number
}

export interface RoomInfoData {
	room: RoomInfo
	users: RoomUser[]
	game: GameInfo | null
	chat: RoomChatInfo
	clock: ClockSnapshot | null
}

export interface RoomWithUsers {
	room: RoomInfo
	users: RoomUser[]
}

export type VerifyStatus = "ongoing" | "check" | "checkmate" | "stalemate" | "perpetual-check"

export type GameEndReason =
	| "checkmate"
	| "stalemate"
	| "perpetual-check"
	| "timeout"
	| "per-move-timeout"
	| "surrender"
	| "leave"
	| "draw"

export interface GameMovements {
	_id: string
	game_id: string
	team: Team
	fen: string
	time_stamp: number
	capture?: PieceCharacter
	surrender_id?: number
	leave?: number
	timeout?: number
	draw?: number
	winner_id?: number
	undo?: number
	end_reason: string
}

export interface MovePieceRequest {
	gameId: string
	newFen: string
	team: Team
	capturePiece: PieceCharacter | null
}

export interface VerifyStateRequest {
	gameId: string
	newFen: string
	checkedTeam: Team
}

export interface VerifyStateResponseData {
	gameEnded: boolean
	inCheck: boolean
	legalMovesCount: number
	status: VerifyStatus
	checkedTeam: Team
	winnerId: number | null
	occurrences: number
}

export interface HistoryData {
	_id: string
	game_id: string
	fen: string
	team: Team | null
	time_stamp: number
	undo?: number
	capture?: string
	captured?: CapturedPieces | null
	userId?: number
	clock?: ClockSnapshot | null
}

export interface RoomActionButton {
	key: string
	icon: string
	label: string
	visible: boolean
	enabled: boolean
	onClick: EmptyPromise | EmptyVoid
}

export interface SurrenderRequest {
	roomId: string | number
	gameId: string
	surrenderingUserId: number
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
	top: RoomUser | null
	bottom: RoomUser | null
}

export interface GameMenuProps {
	buttons: RoomActionButton[]
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
	handleSettingsSaved: StringVoid
}

export type SettingsButtonProps = RoomSettingsDialogContextValue

export interface StartGameBody {
	roomId: string | number
	gameId: string
	status: number
	bot_difficulty: number | null
	clock: ClockSnapshot | null
}
