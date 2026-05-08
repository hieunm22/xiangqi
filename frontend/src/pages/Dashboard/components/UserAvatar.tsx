import classnames from "classnames"
import { Avatar, Stack, Tooltip } from "@mui/material"
import { requireImage } from "common/helper"
import { User, UserAvatarGroupProps } from "../types"

export const UserAvatar = (user: User) => (
	<Tooltip key={user.id} title={user.display_name} arrow placement="top">
		<Avatar
			className="dashboard__avatar"
			src={requireImage(user.avatar_url || "")}
			alt={user.display_name}
		>
			{user.display_name.trim().charAt(0).toUpperCase() || "U"}
		</Avatar>
	</Tooltip>
)

export const UserAvatarGroup = (props: UserAvatarGroupProps) => {
	const { users, type } = props
	const stackClass = classnames("dashboard__avatar-group", type)

	return (
		<Stack
			direction="row"
			alignItems="center"
			className={stackClass}
		>
			{users.map(UserAvatar)}
		</Stack>
	)
}