import classnames from "classnames"
import { Avatar, Badge, Stack, Tooltip, useMediaQuery } from "@mui/material"
import { requireImage } from "common/helper"
import { useOnlinePresence } from "hooks/useOnlinePresence"
import { NumberVoid } from "types/Common"
import { RoomUser } from "pages/Room/types"
import { UserAvatarGroupProps } from "../types"

interface UserAvatarProps extends Pick<RoomUser, "id" | "display_name" | "avatar_url"> {
	size: number
	showPresence?: boolean
	onUserClick?: NumberVoid
}

const AvatarNoBadge = (props: UserAvatarProps) => {
	const { id, display_name, avatar_url, onUserClick } = props

	const handleClick = () => {
		if (onUserClick) {
			onUserClick(id)
		}
	}

	return (
		<Tooltip title={display_name} arrow placement="top">
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

export const UserAvatar = (props: UserAvatarProps) => {
	const { getStatus } = useOnlinePresence()
	const presenceStatus = props.showPresence ? getStatus(props.id) : "offline"
	if (presenceStatus === "busy") {
		return (
			<Badge
				className="busy-badge"
				overlap="circular"
				anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
				variant="dot"
			>
				<AvatarNoBadge {...props} />
			</Badge>
		)
	}

	if (presenceStatus === "online") {
		return (
			<Badge
				className="online-badge"
				overlap="circular"
				anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
				variant="dot"
			>
				<AvatarNoBadge {...props} />
			</Badge>
		)
	}

	if (presenceStatus === "inactive") {
		return (
			<Badge
				className="inactive-badge"
				overlap="circular"
				anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
				variant="dot"
			>
				<AvatarNoBadge {...props} />
			</Badge>
		)
	}

	return <AvatarNoBadge {...props} />
}

export const UserAvatarGroup = (props: UserAvatarGroupProps) => {
	const {
		maxVisible,
		showPresence = false,
		type,
		users,

		onUserClick
	} = props
	const isMobile = useMediaQuery("(max-width:450px)");

	// Determine which users to display
	const needsTruncation = isMobile && users.length > maxVisible + 1
	const players = needsTruncation ? users.slice(0, maxVisible) : users
	const remainingCount = needsTruncation ? users.length - maxVisible : 0
	const stackClass = classnames("dashboard__avatar-group align-center", type)

	return (
		<Stack direction="row" className={stackClass}>
			{players.map(u => <UserAvatar
				key={u.id}
				{...u}
				showPresence={showPresence}
				size={28}
				onUserClick={onUserClick}
			/>)}
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