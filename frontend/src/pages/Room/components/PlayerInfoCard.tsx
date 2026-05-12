import classnames from "classnames"
import { pieceSymbolByType } from "../constant"
import useGameToolkit from "hooks/useGameToolkit"
import { PlayerInfoCardProps } from "../types"
import { TI } from "components/TranslationTag"

export default function PlayerInfoCard(props: PlayerInfoCardProps) {
	const {
		username,
		team,
		avatarUrl,
		mirrored = false,
		isEmpty = false
	} = props
	const { state } = useGameToolkit()
	
	if (isEmpty) {
		const containerClass = classnames("player-info-card empty-slot", `team-${team}`, {
			"is-mirrored": mirrored
		})
		return (
			<div className={containerClass}>
				<div className="player-avatar empty">
					<TI className="fas fa-plus" />
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
				<div className="player-name">{username}</div>
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
