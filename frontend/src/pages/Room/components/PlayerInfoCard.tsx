import classnames from "classnames"
import { PopupState } from "common/enums"
import { TI } from "components/TranslationTag"
import { formatNumber, getCurrentUserId, requireImage } from "common/helper"
import useToolkit from "hooks/useToolkit"
import useLayoutAuth from "pages/Dashboard/hook"
import { setInviteRoomId, setPopup, setRoomHostId } from "toolkit/slice/game"
import { PlayerInfoCardProps } from "../types"

// Bots are rated on a fixed 1–5 difficulty scale
const MAX_BOT_LEVEL = 5

export default function PlayerInfoCard(props: PlayerInfoCardProps) {
	const {
		active = false,
		botLevel,
		roomId,
		team,
		user,
	} = props
	const { showProfilePopup } = useLayoutAuth()
	const { state, gameState, dispatch } = useToolkit()

	const fullAvatarUrl = requireImage(user?.avatar_url || "")
	const currentUserId = getCurrentUserId()

	if (!user) {
		if (props.roomHostId !== currentUserId) {
			return (
				<div className="player-info-card">
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

		// const activeElement = document.activeElement as HTMLElement | null
		// activeElement?.blur()
		dispatch(setRoomHostId(props.roomHostId))
		showProfilePopup(user.id)
	}

	const levelStarsClass = (index: number) => {
		if (botLevel === null) return "far fa-star bot-level-star"
		return index < botLevel ? "fas fa-star bot-level-star" : "far fa-star bot-level-star"
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
				<div
					className={classnames("player-name", { "no-popup": user.is_bot })}
					onClick={user.is_bot ? undefined : handlePlayerNameClick}
				>
					{user?.display_name}
				</div>
				{user.is_bot ? (
					botLevel !== null && (
						<div className="bot-level">
							{Array.from({ length: MAX_BOT_LEVEL }, (_, index) => (
								<i
									key={index}
									className={levelStarsClass(index)}
								/>
							))}
						</div>
					)
				) : (
					<div className="player-total-points">
						<i className="fas fa-sack-dollar user-points" />
						{formatNumber(user?.total_amount, state.lang)}
					</div>
				)}
			</div>
		</div>
	)
}
