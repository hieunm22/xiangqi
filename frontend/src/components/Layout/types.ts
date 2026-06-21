import { Dispatch, SetStateAction } from "react"
import { PrivateConversation } from "components/ChatDialog/types"
import { UserAvatarType } from "types/Common"
import { Users } from "types/Entities"

export interface UserProfileProps {
	isOwnProfile: boolean
}

export interface ConversationDrawerProps {
	conversations: PrivateConversation[]
	onSelect: (conversation: PrivateConversation) => void
}

export type ProfilePopupContextValue = {
	profileUser: Users | null
	setProfileUser: (user: Users | null) => void
	gameStats: GameStats | null
	setGameStats: (stats: GameStats | null) => void
	unreadCount: number
	setUnreadCount: (Dispatch<SetStateAction<number>>)
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

interface UnreadCountByConversation {
	conversation_key: string
	count: number
}

export interface UnreadCountResponse {
	total_pm: number
	conversations: UnreadCountByConversation[]
	announcements: number
}
