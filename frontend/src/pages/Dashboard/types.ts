import { UserAvatarType } from "types/Common"
import { Team } from "types/GameState"

export type DashboardFilter = "all" | "available" | "playing"

export type DashboardRoom = {
	id: number
	name: string
	status: number
	bet_amount: number
	created_at: string
	updated_at: string
	users: UserAvatarType[]
}

export type FetchRoomsResponse = {
	success: boolean
	message: string
	status_code: number
	rooms: DashboardRoom[]
}

export interface UserAvatarGroupProps {
	users: UserAvatarType[]
	type: "primary" | "secondary"
	onUserClick?: (id: number) => Promise<void>
}

export interface PieceSelectionContextValue {
	selectedColor: Team
	setSelectedColor: (color: Team) => void
}

export interface CreateRoomContextValue {
	open: boolean
	setOpen: (open: boolean) => void
}

export interface JoinRoomDialogContextValue {
	room: DashboardRoom | null
	openJoinRoom: (room: DashboardRoom) => void
	closeJoinRoom: () => void
}

export interface SeatAvatarProps {
	user: UserAvatarType
	isHost: boolean
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
