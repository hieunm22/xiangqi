import classnames from "classnames"
import { Avatar, Tooltip } from "@mui/material"
import { requireImage } from "common/helper"
import { RoomUser } from "pages/Room/types"

interface ReplayPlayerCardProps {
	user: RoomUser | null
	active: boolean
}

// Minimal player card for replay: just the avatar with a display-name tooltip.
// No coins/name text (unlike Room's PlayerInfoCard).
const ReplayPlayerCard = ({ user, active }: ReplayPlayerCardProps) => {
	if (!user) {
		return <div className="replay-player-card empty" />
	}

	const cardClass = classnames("replay-player-card", `team-${user.team ?? "red"}`, { active })

	return (
		<div className={cardClass}>
			<Tooltip title={user.display_name} arrow placement="top">
				<Avatar
					className="replay-player-avatar"
					src={requireImage(user.avatar_url || "")}
					alt={user.display_name}
				>
					{user.display_name.trim().charAt(0).toUpperCase() || "U"}
				</Avatar>
			</Tooltip>
		</div>
	)
}

export default ReplayPlayerCard
