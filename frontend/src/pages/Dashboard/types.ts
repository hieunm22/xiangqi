import { RoomUser } from "pages/Room/types"
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
}

export interface UserAvatarGroupProps {
	users: RoomUser[]
	type: "primary" | "secondary"
	maxVisible: number
	onUserClick?: (id: number) => void
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
	onUserClick?: (id: number) => void
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
}
