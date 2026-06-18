import classnames from "classnames"
import { TI } from "components/TranslationTag"
import { formatNumber, requireImage } from "common/helper"
import useToolkit from "hooks/useToolkit"
import { PlayerInfoCardProps } from "../types"
import useLayoutAuth from "pages/Dashboard/hook"

export default function PlayerInfoCard(props: PlayerInfoCardProps) {
	const {
		active = false,
		team,
		user
	} = props
	const { showProfilePopup } = useLayoutAuth()
	const { state } = useToolkit()

	if (user?.display_name === undefined) {
		return (
			<div className="player-info-card loading-slot">
				<TI className="fas fa-circle-north fa-spin" />
			</div>
		)
	}

	const fullAvatarUrl = requireImage(user?.avatar_url || "")

	if (!user) {
		const containerClass = classnames("player-info-card empty-slot", `team-${team}`)
		return (
			<div className={containerClass}>
				<div className="player-avatar empty">
					<TI className="fas fa-user-plus" />
				</div>
			</div>
		)
	}

	const containerClass = classnames("player-info-card", `team-${team}`, {
		"active-turn": active,
	})

	const handlePlayerNameClick = () => {
		if (!user) return

		showProfilePopup(user.id)
	}

	return (
		<div className={containerClass}>
			<div className="player-avatar">
				<img
					className="player-avatar-image"
					src={fullAvatarUrl}
					alt={user?.display_name}
				/>
			</div>
			<div className="player-meta">
				<div className="player-name" onClick={handlePlayerNameClick}>
					{user?.display_name}
				</div>
				<div className="player-total-points">
					<i className="fas fa-sack-dollar user-points" />
					{formatNumber(user?.total_points, state.lang)}
				</div>
			</div>
		</div>
	)
}
