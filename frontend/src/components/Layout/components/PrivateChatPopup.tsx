import { useEffect, useMemo, useRef, useState } from "react"
import { PopupState } from "common/enums"
import ChatDialog from "components/ChatDialog"
import { ConversationDrawer } from "./ConversationDrawer"
import { getClaimsFromLocalStorage, getToken } from "common/helper"
import { useAPI } from "hooks/useAPI"
import { usePopups } from "hooks/useAppContext"
import { useSocket } from "hooks/useSocket"
import useToolkit from "hooks/useToolkit"
import { setPopup, setUserId } from "toolkit/slice/game"
import { APIResponse } from "types/Common"
import { ChatDialogHandle, PrivateConversation } from "components/ChatDialog/types"
import "../Layout.scss"

export const PrivateChatPopup = () => {
	const {
		getPrivateConversations,
		getPrivateMessages,
		markPrivateMessageAsRead,
		sendPrivateMessage,
	} = useAPI()
	const { profileUser, setUnreadCount } = usePopups()
	const { gameState, dispatch } = useToolkit()
	const {
		isConnected,

		offPrivateMessageSent,
		onPrivateMessageSent,
		registerUser
	} = useSocket()
	const [conversations, setConversations] = useState<PrivateConversation[]>([])
	// Display name of the partner picked from the drawer; falls back to the
	// profile that originally opened the chat.
	const [activeTitle, setActiveTitle] = useState<string | null>(null)
	const chatRef = useRef<ChatDialogHandle>(null)

	const isOpen = (gameState.popupState & PopupState.SEND_PM) === PopupState.SEND_PM
	const currentUserId = useMemo(() => {
		const payload = getClaimsFromLocalStorage()
		const id = Number(payload?.sub)
		return Number.isNaN(id) ? null : id
	}, [])

	useEffect(() => {
		const loadConversations = async () => {
			const token = getToken()
			if (!token) return

			const response = await getPrivateConversations(token) as APIResponse<PrivateConversation[]>
			if (response?.success && response.data) {
				setConversations(response.data)
				// Restore the title for the conversation still active from a previous
				// session (e.g. reopened via the user menu); null falls back to the
				// profile that opened the chat, or the loading label.
				const activeConversation = gameState.activeUserId
					? response.data.find((item: PrivateConversation) => item.partner?.id === gameState.activeUserId)
					: undefined
				setActiveTitle(activeConversation?.partner?.display_name ?? null)
			}
		}

		if (isOpen) {
			loadConversations()
		}
	}, [isOpen])

	// Register on the personal socket channel so the backend can push private
	// messages addressed to this user (re-runs on reconnect).
	useEffect(() => {
		if (isConnected && currentUserId) {
			registerUser(currentUserId)
		}
	}, [isConnected, currentUserId])

	// React to incoming private messages: bump the matching conversation to the
	// top of the drawer, increase its unread count and the total badge.
	useEffect(() => {
		const handleIncoming = (data: any) => {
			const senderId = data?.sender?.id
			if (!senderId || senderId === currentUserId) return

			// Don't count as unread the conversation the user is actively viewing.
			const isViewing = isOpen && gameState.activeUserId === senderId
			const nextLastMessage = {
				_id: data._id,
				message: data.message,
				sender_id: senderId,
				timestamp: data.timestamp
			}

			setConversations(prev => {
				const index = prev.findIndex(item => item.conversation_key === data.conversation_key)
				if (index === -1) {
					const newConversation: PrivateConversation = {
						conversation_key: data.conversation_key,
						partner: data.sender,
						last_message: nextLastMessage,
						unread_count: isViewing ? 0 : 1
					}
					return [newConversation, ...prev]
				}

				const existing = prev[index]
				const updated: PrivateConversation = {
					...existing,
					partner: existing.partner ?? data.sender,
					last_message: nextLastMessage,
					unread_count: isViewing ? existing.unread_count : existing.unread_count + 1
				}
				const rest = prev.filter((_, i) => i !== index)
				return [updated, ...rest]
			})

			if (isViewing) {
				// Push the message into the open chat window and mark it read.
				chatRef.current?.appendMessage({
					_id: data._id,
					message: data.message,
					sender: data.sender,
					timestamp: data.timestamp
				})
				const token = getToken()
				if (token) {
					markPrivateMessageAsRead(token, senderId)
				}
			} else {
				setUnreadCount(prev => prev + 1)
			}
		}

		onPrivateMessageSent(handleIncoming)
		return () => offPrivateMessageSent(handleIncoming)
	}, [
		onPrivateMessageSent,
		offPrivateMessageSent,
		currentUserId,
		isOpen,
		gameState.activeUserId
	])

	const onClose = () => {
		dispatch(setPopup(PopupState.NONE))
	}

	const handleSelectConversation = (conversation: PrivateConversation) => {
		if (!conversation.partner) return
		setActiveTitle(conversation.partner.display_name)
		dispatch(setUserId(conversation.partner.id))
		// Clear the unread badge immediately; ChatDialog marks the conversation
		// as read on the backend when it loads the messages.
		setConversations(prev => prev.map(item =>
			item.conversation_key === conversation.conversation_key
				? { ...item, unread_count: 0 }
				: item
		))
		// Subtract this conversation's unread messages from the total shown on
		// the user button badge.
		if (conversation.unread_count > 0) {
			setUnreadCount(prev => Math.max(0, prev - conversation.unread_count))
		}
	}

	return (
		<ChatDialog
			ref={chatRef}
			open={isOpen}
			onClose={onClose}
			title={activeTitle || profileUser?.display_name || ""}
			dialogType="private"
			getMessages={getPrivateMessages}
			sendMessage={sendPrivateMessage}
			markAsRead={markPrivateMessageAsRead}
			refId={gameState.activeUserId}
			// props for private chat popup
			drawerContent={
				<ConversationDrawer
					conversations={conversations}
					onSelect={handleSelectConversation}
				/>
			}
		/>
	)
}
