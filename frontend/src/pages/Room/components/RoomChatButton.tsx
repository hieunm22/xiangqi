import { Badge } from "@mui/material"
import { TI } from "components/TranslationTag"
import { RoomChatDialog } from "./RoomChatDialog"
import { RoomChatDialogContext } from "hooks/useAppContext"
import { RoomChatButtonProps } from "../types"

export const RoomChatButton = (props: RoomChatButtonProps) => {
	return (
		<RoomChatDialogContext.Provider value={props}>
			<Badge
				className="cursor-pointer"
				badgeContent={props.unreadCount}
				color="error"
				overlap="rectangular"
				onClick={props.openChat}
			>
				<TI
					className="room-more-action fas fa-comments"
					onClick={props.openChat}
				/>
			</Badge>
			<RoomChatDialog />
		</RoomChatDialogContext.Provider>
	)
}

export default RoomChatButton
