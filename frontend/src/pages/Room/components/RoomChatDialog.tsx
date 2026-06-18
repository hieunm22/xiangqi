import { useEffect, useRef } from "react"
import ChatDialog from "components/ChatDialog"
import { ChatDialogHandle } from "components/ChatDialog/types"
import { getToken } from "common/helper"
import { useAPI } from "hooks/useAPI"
import { useRoomChatDialogContext } from "hooks/useAppContext"
import "../Room.scss"

export const RoomChatDialog = () => {
	const {
		getRoomMessages,
		markRoomMessageAsRead,
		sendRoomMessage,
	} = useAPI()
	const {
		incomingMessage,
		open,
		roomId,
		roomName,

		onClose
	} = useRoomChatDialogContext()
	const chatRef = useRef<ChatDialogHandle>(null)

	// Push real-time room messages into the open dialog and mark them as read
	useEffect(() => {
		if (!open || !incomingMessage) {
			return
		}

		chatRef.current?.appendMessage(incomingMessage)

		const token = getToken()
		if (token) {
			markRoomMessageAsRead(token, roomId)
		}
	}, [incomingMessage, open])

	return (
		<ChatDialog
			ref={chatRef}
			open={open}
			onClose={onClose}
			title={roomName}
			dialogType="room"
			getMessages={getRoomMessages}
			sendMessage={sendRoomMessage}
			markAsRead={markRoomMessageAsRead}
			refId={roomId}
		/>
	)
}
