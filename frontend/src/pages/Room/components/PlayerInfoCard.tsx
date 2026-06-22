import classnames from "classnames"
import { PopupState } from "common/enums"
import { TI } from "components/TranslationTag"
import { formatNumber, getCurrentUserId, requireImage } from "common/helper"
import useToolkit from "hooks/useToolkit"
import useLayoutAuth from "pages/Dashboard/hook"
import { setInviteRoomId, setPopup, setRoomHostId } from "toolkit/slice/game"
import { PlayerInfoCardProps } from "../types"

export default function PlayerInfoCard(props: PlayerInfoCardProps) {
	const {
		active = false,
		team,
		user,
		roomId,
	} = props
	const { showProfilePopup } = useLayoutAuth()
	const { state, gameState, dispatch } = useToolkit()

	const fullAvatarUrl = requireImage(user?.avatar_url || "")
	const currentUserId = getCurrentUserId()

	if (!user) {
		if (props.roomHostId !== currentUserId) {
			return (
				<div className="player-info-card loading-slot">
					<TI className="fas fa-circle-north fa-spin" />
				</div>
			)
		}
		const containerClass = classnames("player-info-card empty-slot cursor-pointer", `team-${team}`)
		const handleEmptySlotClick = () => {
			if (roomId !== null) {
				dispatch(setInviteRoomId(roomId))
			}
			dispatch(setPopup(gameState.popupState | PopupState.SEARCH_USERS))
		}

		return (
			<div className={containerClass} onClick={handleEmptySlotClick}>
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

		dispatch(setRoomHostId(props.roomHostId))
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
