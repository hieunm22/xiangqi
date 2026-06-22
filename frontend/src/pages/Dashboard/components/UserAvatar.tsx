import classnames from "classnames"
import { Avatar, Stack, Tooltip, useMediaQuery } from "@mui/material"
import { requireImage } from "common/helper"
import { RoomUser } from "pages/Room/types"
import { UserAvatarGroupProps } from "../types"

interface UserAvatarProps extends RoomUser {
	size: number
	onUserClick?: (id: number) => void
}

export const UserAvatar = (props: UserAvatarProps) => {
	const { id, display_name, avatar_url, onUserClick } = props

	const handleClick = () => {
		if (onUserClick) {
			onUserClick(id)
		}
	}

	return (
		<Tooltip key={id} title={display_name} arrow placement="top">
			<Avatar
				className="dashboard__avatar"
				src={requireImage(avatar_url || "")}
				alt={display_name}
				onClick={handleClick}
				sx={{
					width: props.size,
					height: props.size,
					cursor: onUserClick ? "pointer" : "default",
					"&:hover": onUserClick ? { opacity: 0.8 } : {}
				}}
			>
				{display_name.trim().charAt(0).toUpperCase() || "U"}
			</Avatar>
		</Tooltip>
	)
}

export const UserAvatarGroup = (props: UserAvatarGroupProps) => {
	const { maxVisible, type, users, onUserClick } = props
	const isMobile = useMediaQuery("(max-width:450px)");
	
	// Determine which users to display
	const needsTruncation = isMobile && users.length > maxVisible + 1
	const players = needsTruncation ? users.slice(0, maxVisible) : users	
	const remainingCount = needsTruncation ? users.length - maxVisible : 0
	const stackClass = classnames("dashboard__avatar-group align-center", type)

	return (
		<Stack direction="row" className={stackClass}>
			{players.map(u => <UserAvatar key={u.id} {...u} size={28} onUserClick={onUserClick} />)}
			{remainingCount > 0 && (
				<Tooltip title={`${remainingCount} more spectators`} arrow placement="top">
					<Avatar className="dashboard__avatar dashboard__avatar-more">
						+{remainingCount}
					</Avatar>
				</Tooltip>
			)}
		</Stack>
	)
}