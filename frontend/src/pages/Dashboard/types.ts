import { Team } from "types/GameState"

export type DashboardFilter = "all" | "available" | "playing"

export type DashboardRoom = {
	id: number
	name: string
	status: number
	bet_amount: number
	created_at: string
	updated_at: string
	users: User[]
}

export type FetchRoomsResponse = {
	success: boolean
	message: string
	status_code: number
	rooms: DashboardRoom[]
}

export type User = {
	id: number
	display_name: string
	avatar_url: string | null
}

export interface UserAvatarGroupProps {
	users: User[]
	type: "primary" | "secondary"
}

export interface PieceSelectionContextValue {
	selectedColor: Team
	setSelectedColor: (color: Team) => void
}

export interface CreateRoomContextValue {
	open: boolean
	setOpen: (open: boolean) => void
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
