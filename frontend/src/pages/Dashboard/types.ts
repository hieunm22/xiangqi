import { Team } from "types/GameState"

export type DashboardFilter = "all" | "available" | "playing"

export type DashboardGame = {
	id: string
	name: string
	status: number
	bet_amount: number
	created_at: string
	updated_at: string
	users: User[]
}

export type FetchGamesResponse = {
	success: boolean
	message: string
	status_code: number
	games: DashboardGame[]
}

export type User = {
	id: string
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

export interface CreateGameContextValue {
	open: boolean
	setOpen: (open: boolean) => void
}

export interface PieceButtonProps {
	piece: Team
	label: string
}

export interface GameCardProps {
	game: DashboardGame
}

export interface CreateGameRequest {
	tableName: string
	teamName: Team
	redFirst: boolean
	betAmount: number
}
