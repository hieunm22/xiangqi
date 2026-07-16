import { ReactNode } from "react"
import { EmptyVoid, UserAvatarType } from "types/Common"

export interface ChatDialogProps {
	open: boolean
	refId: number | null // roomId for room chat, receiverId for private chat
	title: string
	dialogType: "room" | "private"
	onClose: EmptyVoid
	getMessages: (token: string, refId: number) => Promise<any>
	sendMessage: (token: string, refId: number, message: string) => Promise<any>
	markAsRead: (token: string, refId: number) => Promise<any>
	// Optional content for the in-dialog slide-out drawer. When provided, a
	// hamburger toggle appears in the title bar; otherwise the drawer is hidden.
	drawerContent?: ReactNode
	// Callback invoked after a message is successfully sent.
	onMessageSent?: (message: SentMessagePayload) => void
}

// Minimal payload the dialog hands back on a successful send
export interface SentMessagePayload {
	message: string
	receiverId: number
	timestamp: string
}

// Imperative handle so callers can push a real-time message into the open dialog
export interface ChatDialogHandle {
	appendMessage: (message: BaseChatMessage) => void
}

export type BaseChatMessage = {
	_id: string
	message: string
	sender: UserAvatarType
	timestamp: string
	seen: boolean
}

export interface RoomChatMessage extends BaseChatMessage {
	room_id: number
	read_by: number[]
}

export interface PrivateChatMessage extends BaseChatMessage {
	receiver_id: number
}

export type AnnouncementMessage = BaseChatMessage

export interface ChatDialogDragPosition {
	startX: number
	startY: number
	originX: number
	originY: number
}

export interface MousePosition {
	x: number
	y: number
}

interface ConversationLastMessage {
	_id: string
	message: string
	sender_id: number
	timestamp: string
}

export interface PrivateConversation {
	conversation_key: string
	partner: UserAvatarType | null
	last_message: ConversationLastMessage
	unread_count: number
}
