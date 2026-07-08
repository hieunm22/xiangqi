import classnames from "classnames"
import {
	Box,
	Divider,
	Stack,
	Tooltip,
	Typography
} from "@mui/material"
import { TTypography } from "components/TranslationTag"
import { UserAvatar } from "pages/Dashboard/components/UserAvatar"
import { formatTimestampToDateTimeArray, getCurrentUserId } from "common/helper"
import useToolkit from "hooks/useToolkit"
import { MessageListProps } from "../types"
import "../MessageThread.scss"

export const MessageList = (props: MessageListProps) => {
	const {
		endRef,
		firstUnreadId,
		messages,
		showPresence,

		getRowRef,
		isUnread,
		onAvatarClick
	} = props
	const { state } = useToolkit()
	const currentUserId = getCurrentUserId()

	return (
		<Stack spacing={1}>
			{props.loadingOlder && (
				<TTypography
					variant="caption"
					color="text.secondary"
					className="announce-loading-older"
					content="announce.loading-older"
				/>
			)}
			{messages.map((msg, idx) => {
				const senderId = msg.sender?.id ?? null
				const isSender = senderId === currentUserId
				const nextSenderId = messages[idx + 1]?.sender?.id ?? null
				const isLastMessageInSenderGroup = senderId === null || senderId !== nextSenderId
				const shouldShowAvatar = !isSender && isLastMessageInSenderGroup
				const unread = isUnread(msg, isSender)
				const showUnreadDivider = firstUnreadId !== null && msg._id === firstUnreadId && unread
				const boxContent = classnames("message-row", {
					end: isSender,
					start: !isSender
				})
				const contentClass = classnames("message-content", {
					sender: isSender,
					receiver: !isSender,
					unread
				})
				const senderName = msg.sender?.display_name || "Unknown user"
				const times = formatTimestampToDateTimeArray(msg.timestamp, state.lang)
				const timeString = `${times[0] ? times[0] + ", " : ""}${times[1]}`

				return (
					<Box key={msg._id} ref={getRowRef?.(msg, idx)}>
						{showUnreadDivider && (
							<Divider textAlign="center" className="message-unread-divider">
								<TTypography
									variant="caption"
									className="message-unread-divider-text"
									content="chat.messages.unread"
								/>
							</Divider>
						)}
						<Box className={boxContent}>
							{!isSender && (
								<Box className="message-avatar-container">
									{shouldShowAvatar && (
										<UserAvatar
											id={msg.sender?.id ?? 0}
											avatar_url={msg.sender?.avatar_url || ""}
											display_name={senderName}
											showPresence={showPresence}
											onUserClick={onAvatarClick}
											size={36}
										/>
									)}
								</Box>
							)}
							<Tooltip title={timeString} arrow placement={isSender ? "left" : "right"}>
								<Typography variant="body2" className={contentClass}>
									{msg.message}
								</Typography>
							</Tooltip>
						</Box>
					</Box>
				)
			})}
			<div ref={endRef} />
		</Stack>
	)
}

MessageList.displayName = "MessageList"
