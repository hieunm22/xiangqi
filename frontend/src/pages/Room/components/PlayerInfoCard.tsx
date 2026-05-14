import classnames from "classnames"
import { pieceSymbolByType } from "../constant"
import { TI } from "components/TranslationTag"
import { usePopups } from "components/Layout/context"
import { useAPI } from "hooks/useAPI"
import useGameToolkit from "hooks/useGameToolkit"
import { APIResponse } from "types/Common"
import { Users } from "types/Entities"
import { PlayerInfoCardProps } from "../types"

export default function PlayerInfoCard(props: PlayerInfoCardProps) {
	const {
		username,
		team,
		avatarUrl,
		mirrored = false,
		isEmpty = false,
		userId = null
	} = props
	const { state } = useGameToolkit()
	const { setOpenProfilePopup, setProfileUser } = usePopups()
	const { getUserById } = useAPI()
	
	if (isEmpty) {
		const containerClass = classnames("player-info-card empty-slot", `team-${team}`, {
			"is-mirrored": mirrored
		})
		return (
			<div className={containerClass}>
				<div className="player-avatar empty">
					<TI className="fas fa-user-plus" />
				</div>
			</div>
		)
	}

	const avatarInitial = username.trim().charAt(0).toUpperCase() || "U"
	const containerClass = classnames("player-info-card", `team-${team}`, {
		"active-turn": state.teamTurn === team,
		"is-mirrored": mirrored
	})

	const capturedPieces = state.capturedPieces[team]
	const capturedTeam = team === "red" ? "black" : "red"

	const handlePlayerNameClick = async () => {
		if (!userId) return

		const userResponse: APIResponse<Users> = await getUserById(userId)
		if (userResponse && userResponse.data) {
			setProfileUser(userResponse.data)
			setOpenProfilePopup(true)
		}
	}

	return (
		<div className={containerClass}>
			<div className="player-avatar">
				{avatarUrl ? (
					<img className="player-avatar-image" src={avatarUrl} alt={username} />
				) : (
					avatarInitial
				)}
			</div>
			<div className="player-meta">
				<div
					className="player-name" 
					onClick={handlePlayerNameClick}
					style={{ cursor: userId ? "pointer" : "default" }}
				>
					{username}
				</div>
				<div className={classnames("player-general", `team-${team}`)}>
				</div>
				<div className={classnames("captured-pieces", `team-${capturedTeam}`)}>
					{capturedPieces.map((symbol, index) => (
						<span className="captured-piece" key={`${symbol}-${index}`}>
							{pieceSymbolByType[capturedTeam][symbol]}
						</span>
					))}
				</div>
			</div>
		</div>
	)
}
