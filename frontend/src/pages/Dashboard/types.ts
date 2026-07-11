import { GameType } from "common/variants"
import { RoomUser } from "pages/Room/types"
import { NumberVoid } from "types/Common"
import { Team } from "types/GameState"

export type DashboardFilter = "all" | "available" | "playing"

export type DashboardRoom = {
	id: number
	name: string
	status: number
	game_type: GameType
	bet_amount: number
	red_first: boolean
	host_id: number | null
	created_at: string
	updated_at: string
	users: RoomUser[]
	// Per-player total time budget in seconds; null / omitted = no clock.
	time_limit?: number | null
}

export interface UserAvatarGroupProps {
	users: RoomUser[]
	type: "primary" | "secondary"
	maxVisible: number
	showPresence?: boolean
	onUserClick?: NumberVoid
}

export interface PieceSelectionContextValue {
	selectedColor: Team
	setSelectedColor: (color: Team) => void
}

export interface CreateRoomContextValue {
	open: boolean
	setOpen: (open: boolean) => void
}

export interface SeatAvatarProps {
	user: RoomUser | null
	isHost: boolean
	onUserClick?: NumberVoid
}

export interface PieceButtonProps {
	piece: Team
	label: React.ReactNode
}

export interface RoomCardProps {
	room: DashboardRoom
}

export interface CreateRoomRequest {
	tableName: string
	// Variant seat: "red"/"black" for xiangqi, "white"/"black" for chess.
	teamName: Team
	redFirst: boolean
	pveMode: boolean
	betAmount: number
	// Per-player total time budget in seconds; null = no clock.
	timeLimit: number | null
	gameType: GameType
}
