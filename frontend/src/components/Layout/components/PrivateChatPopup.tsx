import { useEffect, useRef, useState } from "react"
import { PopupState } from "common/enums"
import ChatDialog from "components/ChatDialog"
import { ConversationDrawer } from "./ConversationDrawer"
import { getCurrentUserId, getToken } from "common/helper"
import { useAPI } from "hooks/useAPI"
import { useProfilePopup } from "hooks/useAppContext"
import { useSocket } from "hooks/useSocket"
import useToolkit from "hooks/useToolkit"
import { setPopup, setUserId } from "toolkit/slice/game"
import { APIResponse } from "types/Common"
import {
	ChatDialogHandle,
	PrivateConversation,
	SentMessagePayload
} from "components/ChatDialog/types"
import "../Layout.scss"

export const PrivateChatPopup = () => {
	const {
		getPrivateConversations,
		getPrivateMessages,
		markPrivateMessageAsRead,
		sendPrivateMessage,
	} = useAPI()
	const { profileUser, setUnreadCount } = useProfilePopup()
	const { gameState, dispatch } = useToolkit()
	const {
		isConnected,

		offPrivateMessageSent,
		onPrivateMessageSent,
		registerUser
	} = useSocket()
	const [conversations, setConversations] = useState<PrivateConversation[]>([])
	const chatRef = useRef<ChatDialogHandle>(null)

	const isOpen = (gameState.popupState & PopupState.SEND_PM) === PopupState.SEND_PM
	const currentUserId = getCurrentUserId()

	useEffect(() => {
		const loadConversations = async () => {
			const token = getToken()
			if (!token) return

			const response = await getPrivateConversations(token) as APIResponse<PrivateConversation[]>
			if (response?.success && response.data) {
				setConversations(response.data)
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
					timestamp: data.timestamp,
					seen: true
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
		// Clear only the SEND_PM bit.
		const next = gameState.popupState & ~PopupState.SEND_PM
		dispatch(setPopup(next || PopupState.NONE))
	}

	const handleSelectConversation = (conversation: PrivateConversation) => {
		if (!conversation.partner) return
		dispatch(setUserId(conversation.partner.id))
		// Clear the unread badge immediately
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

	// After the current user sends a private message, upsert the drawer list
	// to make brand-new conversation shows immediately
	const handleMessageSent = (payload: SentMessagePayload) => {
		if (!currentUserId) return

		const { message, receiverId, timestamp } = payload
		// Same key the backend derives (min_max of the two user ids)
		const minId = Math.min(currentUserId, receiverId)
		const maxId = Math.max(currentUserId, receiverId)
		const conversationKey = `${minId}_${maxId}`
		const lastMessage = {
			_id: `local-${timestamp}`,
			message,
			sender_id: currentUserId,
			timestamp
		}

		setConversations(prev => {
			const index = prev.findIndex(item => item.conversation_key === conversationKey)
			if (index === -1) {
				// First message to this partner: the partner is the receiver we're
				// chatting with (profileUser is set when the chat was opened).
				const partner = profileUser && profileUser.id === receiverId
					? {
						id: profileUser.id,
						display_name: profileUser.display_name,
						avatar_url: profileUser.avatar_url
					}
					: null
				const newConversation: PrivateConversation = {
					conversation_key: conversationKey,
					partner,
					last_message: lastMessage,
					unread_count: 0
				}
				return [newConversation, ...prev]
			}

			const existing = prev[index]
			const updated: PrivateConversation = { ...existing, last_message: lastMessage }
			return [updated, ...prev.filter((_, i) => i !== index)]
		})
	}

	const activePartner = conversations
		.find(item => item.partner?.id === gameState.activeUserId)?.partner
	const targetName = profileUser?.id === gameState.activeUserId ? profileUser.display_name : null
	const chatTitle = activePartner?.display_name || targetName || "menu.messages"

	return (
		<ChatDialog
			ref={chatRef}
			open={isOpen}
			onClose={onClose}
			title={chatTitle}
			dialogType="private"
			getMessages={getPrivateMessages}
			sendMessage={sendPrivateMessage}
			markAsRead={markPrivateMessageAsRead}
			refId={gameState.activeUserId}
			onMessageSent={handleMessageSent}
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
