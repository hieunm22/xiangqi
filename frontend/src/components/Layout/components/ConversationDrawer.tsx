import classnames from "classnames"
import {
	Badge,
	Box,
	List,
	ListItemButton,
	Typography
} from "@mui/material"
import { UserAvatar } from "pages/Dashboard/components/UserAvatar"
import useToolkit from "hooks/useToolkit"
import { ConversationDrawerProps } from "../types"

export const ConversationDrawer = (props: ConversationDrawerProps) => {
	const { conversations, onSelect } = props
	const { gameState } = useToolkit()

	return (
		<List disablePadding className="chat-conversation-list">
			{conversations.map(conversation => {
				const { partner, last_message, unread_count } = conversation
				if (!partner) return null
				const isActive = partner.id === gameState.activeUserId
				const itemClass = classnames("chat-conversation-item", { active: isActive })
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
								size={36}
							/>
						</Badge>
						<Box className="chat-conversation-text">
							<Typography variant="body2" className="chat-conversation-name" noWrap>
								{partner.display_name}
							</Typography>
							<Typography
								variant="caption"
								className="chat-conversation-preview"
								color="text.secondary"
								noWrap
							>
								{last_message.message}
							</Typography>
						</Box>
					</ListItemButton>
				)
			})}
		</List>
	)
}
