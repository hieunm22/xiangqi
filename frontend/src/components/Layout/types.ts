import { Dispatch, ReactNode, SetStateAction } from "react"
import { PrivateConversation } from "components/ChatDialog/types"
import { UserAvatarType } from "types/Common"
import { Users } from "types/Entities"
import { Team } from "types/GameState"

export interface UserProfileProps {
	isOwnProfile: boolean
}

export interface ConversationDrawerProps {
	conversations: PrivateConversation[]
	onSelect: (conversation: PrivateConversation) => void
}

export type ProfilePopupContextValue = {
	currentUser: Users | null
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

export interface Achievement {
	id: number
	name: string
	earned: boolean
}

export interface UserProfileWithStats {
	user: Users
	stats: GameStats
}

interface UpdateUserInfo {
	display_name?: string
	email?: string
	avatar_seq: number
	avatar_url: string
}

export type SearchUserType = UserAvatarType & {
	total_amount: number
}

export interface ProfileTabProps {
	user: Users | null
}

export type UpdateUserInfoPayload = UpdateUserInfo

export type UpdateUserInfoResponse = UpdateUserInfo

export interface HistoryTabProps {
	gameHistories: GameHistoryItem[] | null
	onOpenReplay: (item: GameHistoryItem) => void
}

interface GameHistory {
	gameId: string
	ends_at: string | Date | null
	winner_id: number | null
}

export interface GameHistoryUser extends UserAvatarType {
	team: Team | null
}

export interface GameHistoryItem {
	game: GameHistory
	users: GameHistoryUser[]
	amount: number
}

export interface PlayerAvatarsProps {
	game: GameHistoryItem
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

export type ChangePasswordBodyType = {
	currentPassword: string
	newPassword: string
}

export type EditableProfileFieldProps = {
	className?: string
	editable: boolean
	extraActions?: ReactNode
	field: "display_name" | "email"
	renderDisplay?: (value: string) => ReactNode
	type: "email" | "text"
	value: string
}
