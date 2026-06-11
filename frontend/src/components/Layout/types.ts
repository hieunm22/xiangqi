import { UserAvatarType } from "types/Common"
import { Users } from "types/Entities"

export interface UserProfileProps {
	isOwnProfile: boolean
}

export type ProfilePopupContextValue = {
	profileUser: Users | null
	setProfileUser: (user: Users | null) => void
}

export interface GameStats {
	win: number
	draw: number
	lose: number
}

export interface UserProfileWithStats {
	user: Users
	stats: GameStats
}

interface GameHistory {
	gameId: string
	ends_at?: string | Date
}

export interface GameHistoryItem {
	game: GameHistory
	users: UserAvatarType[]
	point: number
}
