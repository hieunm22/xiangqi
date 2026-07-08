import { Ref } from "react"
import { BaseChatMessage } from "components/ChatDialog/types"

export interface MessageListProps {
  messages: BaseChatMessage[]
  firstUnreadId: string | null
  // Concrete unread rule, supplied by the caller since it depends on the message variant
  isUnread: (msg: BaseChatMessage, isSender: boolean) => boolean
  onAvatarClick: (userId: number) => void
  showPresence?: boolean
  // Ref for the bottom sentinel used by the caller's scroll-to-bottom logic.
  endRef?: Ref<HTMLDivElement>
  // Per-row ref so the caller can pin scroll anchors (first unread, first
  // message for "load older", etc.). Return undefined for rows it doesn't track.
  getRowRef?: (msg: BaseChatMessage, idx: number) => Ref<HTMLDivElement> | undefined
  loadingOlder: boolean
}

export interface MessageInputProps {
	value: string
	placeholder: string
	disabled?: boolean
	autoFocus?: boolean
	onChange: (value: string) => void
	onSend: () => void
}
