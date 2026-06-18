import { useEffect, useState } from "react"
import { PopupState } from "common/enums"
import ChatDialog from "components/ChatDialog"
import { ConversationDrawer } from "./ConversationDrawer"
import { getToken } from "common/helper"
import { useAPI } from "hooks/useAPI"
import { usePopups } from "hooks/useAppContext"
import useToolkit from "hooks/useToolkit"
import { setPopup, setUserId } from "toolkit/slice/game"
import { PrivateConversation } from "components/ChatDialog/types"
import "../Layout.scss"

export const PrivateChatPopup = () => {
	const {
		getPrivateConversations,
		getPrivateMessages,
		markPrivateMessageAsRead,
		sendPrivateMessage,
	} = useAPI()
	const { profileUser } = usePopups()
	const { gameState, dispatch } = useToolkit()
	const [conversations, setConversations] = useState<PrivateConversation[]>([])
	// Display name of the partner picked from the drawer; falls back to the
	// profile that originally opened the chat.
	const [activeTitle, setActiveTitle] = useState<string | null>(null)

	const isOpen = gameState.popupState === PopupState.SEND_PM

	useEffect(() => {
		const loadConversations = async () => {
			const token = getToken()
			if (!token) return

			const response = await getPrivateConversations(token)
			if (response?.success && response.data) {
				setConversations(response.data)
			}
		}

		if (isOpen) {
			setActiveTitle(null)
			loadConversations()
		}
	}, [isOpen])

	const onClose = () => {
		dispatch(setPopup(PopupState.NONE))
	}

	const handleSelectConversation = (conversation: PrivateConversation) => {
		if (!conversation.partner) return
		setActiveTitle(conversation.partner.display_name)
		dispatch(setUserId(conversation.partner.id))
	}

	return (
		<ChatDialog
			open={isOpen}
			onClose={onClose}
			title={activeTitle || profileUser?.display_name || "Loading..."}
			dialogType="private"
			getMessages={getPrivateMessages}
			sendMessage={sendPrivateMessage}
			markAsRead={markPrivateMessageAsRead}
			// activeUserId is the userId of the person we're chatting with in private chat
			refId={gameState.activeUserId}
			drawerContent={
				<ConversationDrawer
					conversations={conversations}
					onSelect={handleSelectConversation}
				/>
			}
		/>
	)
}
