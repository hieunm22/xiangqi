import classnames from "classnames"
import {
	Badge,
	Box,
	List,
	ListItemButton,
	SxProps,
	Theme,
	Tooltip,
	Typography
} from "@mui/material"
import { UserAvatar } from "pages/Dashboard/components/UserAvatar"
import { formatTimestampToDateTimeArray, getCurrentUserId } from "common/helper"
import useToolkit from "hooks/useToolkit"
import { translate } from "locales/translate"
import { ConversationDrawerProps } from "../types"

export const ConversationDrawer = (props: ConversationDrawerProps) => {
	const { conversations, onSelect } = props
	const { gameState, state } = useToolkit()
	const currentUserId = getCurrentUserId()

	const unreadStyle = (unread_count: number) => {
		return { fontWeight: unread_count > 0 ? "bold" : "normal" } as SxProps<Theme>
	}

	return (
		<List disablePadding className="chat-conversation-list">
			{conversations.map(conversation => {
				const { partner, last_message, unread_count } = conversation
				if (!partner) return null
				const isActive = partner.id === gameState.activeUserId
				const itemClass = classnames("chat-conversation-item", { active: isActive })
				// Prefix the preview with "You:" when the current user sent the last message.
				const previewText = last_message.sender_id === currentUserId
					? `${translate("chat.conversation.you")}: ${last_message.message}`
					: last_message.message
				// [dateLabel, timeLabel]: when dateLabel exists, show it with the time
				// as a tooltip; otherwise (today) just show the time.
				const formatTimeStamp = formatTimestampToDateTimeArray(last_message.timestamp, state.lang)
				const [dateLabel, timeLabel] = formatTimeStamp
				return (
					<ListItemButton
						key={conversation.conversation_key}
						className={itemClass}
						onClick={() => onSelect(conversation)}
					>
						<Badge
							color="error"
							badgeContent={unread_count}
							invisible={unread_count <= 0}
							overlap="circular"
						>
							<UserAvatar
								id={partner.id}
								avatar_url={partner.avatar_url}
								display_name={partner.display_name}
								showPresence
								size={36}
							/>
						</Badge>
						<Box className="chat-conversation-text">
							<Typography
								variant="body2"
								sx={unreadStyle(unread_count)}
								className="chat-conversation-name"
								noWrap
							>
								{partner.display_name}
							</Typography>
							<Box className="chat-conversation-preview-row">
								<Typography
									variant="caption"
									sx={unreadStyle(unread_count)}
									className="chat-conversation-preview"
									color="text.secondary"
									noWrap
								>
									{previewText}
								</Typography>
								{dateLabel ? (
									<Tooltip title={timeLabel} arrow placement="top">
										<Typography
											variant="caption"
											className="chat-conversation-time"
											color="text.secondary"
										>
											{dateLabel}
										</Typography>
									</Tooltip>
								) : (
									<Typography
										variant="caption"
										className="chat-conversation-time"
										color="text.secondary"
									>
										{timeLabel}
									</Typography>
								)}
							</Box>
						</Box>
					</ListItemButton>
				)
			})}
		</List>
	)
}
