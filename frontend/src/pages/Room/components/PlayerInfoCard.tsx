import classnames from "classnames"
import { PopupState } from "components/Layout/enums"
import { TI } from "components/TranslationTag"
import { requireImage } from "common/helper"
import { usePopups } from "hooks/useAppContext"
import { useAPI } from "hooks/useAPI"
import useToolkit from "hooks/useToolkit"
import { setPopup } from "toolkit/slice/home"
import { APIResponse } from "types/Common"
import { Users } from "types/Entities"
import { PlayerInfoCardProps } from "../types"

export default function PlayerInfoCard(props: PlayerInfoCardProps) {
	const {
		active = false,
		avatarUrl,
		isEmpty = false,
		team,
		userId = null,
		username,
	} = props
	const { setProfileUser } = usePopups()
	const { getUserById } = useAPI()
	const { dispatch } = useToolkit()

	if (username === undefined) {
		return (
			<div className="player-info-card loading-slot">
				<TI className="fas fa-circle-north fa-spin" />
			</div>
		)
	}

	const fullAvatarUrl = requireImage(avatarUrl || "")

	if (isEmpty) {
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
		if (!userId) return

		const userResponse: APIResponse<Users> = await getUserById(userId)
		if (userResponse && userResponse.data) {
			setProfileUser(userResponse.data)
			dispatch(setPopup(PopupState.PROFILE)) // open profile popup
		}
	}

	return (
		<div className={containerClass}>
			<div className="player-avatar">
				<img className="player-avatar-image" src={fullAvatarUrl} alt={username} />
			</div>
			<div className="player-meta">
				<div className="player-name" onClick={handlePlayerNameClick}>
					{username}
				</div>
				<div className={classnames("player-general", `team-${team}`)}>
				</div>
			</div>
		</div>
	)
}
