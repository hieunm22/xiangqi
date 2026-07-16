import { RoomUser } from "pages/Room/types"
import { NumberVoid } from "types/Common"
import { Team } from "types/GameState"

export type DashboardFilter = "all" | "available" | "playing"

export type DashboardRoom = {
	id: number
	name: string
	status: number
	bet_amount: number
	red_first: boolean
	host_id: number | null
	created_at: string
	updated_at: string
	users: RoomUser[]
	// Per-player total time budget in seconds; null / omitted = no clock.
	time_limit: number | null
	time_increment: number | null
	time_per_move: number | null
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
	label: string
}

export interface RoomCardProps {
	room: DashboardRoom
}

export interface CreateRoomRequest {
	tableName: string
	teamName: Team
	redFirst: boolean
	pveMode: boolean
	betAmount: number
	// Per-player total time budget in seconds; null = no clock.
	timeLimit: number | null
	timeIncrement?: number | null
	timePerMove?: number | null
}
