import classnames from "classnames"
import { LS_TOKEN_KEY } from "common/constant"
import { PopupState } from "components/Layout/enums"
import { TI } from "components/TranslationTag"
import { formatNumber, requireImage } from "common/helper"
import useToolkit from "hooks/useToolkit"
import {
	setPopup,
	setRoomInfo,
	setUserId,
} from "toolkit/slice/game"
import { PlayerInfoCardProps } from "../types"

export default function PlayerInfoCard(props: PlayerInfoCardProps) {
	const {
		active = false,
		room,
		roomHostId,
		team,
		user
	} = props
	const { state, dispatch } = useToolkit()

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

	const handlePlayerNameClick = async () => {
		if (!user?.id) return
		
		const token = localStorage.getItem(LS_TOKEN_KEY)
		if (!token) return
		dispatch(setRoomInfo({ roomInfo: room, roomHostId }))
		dispatch(setUserId(user.id)) // open profile popup
		dispatch(setPopup(PopupState.PROFILE)) // open profile popup
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
