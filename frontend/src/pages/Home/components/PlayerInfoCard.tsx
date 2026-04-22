import classnames from "classnames"
import { pieceSymbolByType } from "../constant"
import useGameToolkit from "hooks/useGameToolkit"
import { PlayerInfoCardProps } from "../types"

export default function PlayerInfoCard(props: PlayerInfoCardProps) {
	const {
		username,
		team,
		mirrored = false
	} = props
	const avatarInitial = username.trim().charAt(0).toUpperCase() || "U"
	const { state } = useGameToolkit()
	const containerClass = classnames("player-info-card", `team-${team}`, {
		"active-turn": state.teamTurn === team,
		"is-mirrored": mirrored
	})

	const capturedPieces = state.capturedPieces[team]
	const capturedTeam = team === "red" ? "black" : "red"

	return (
		<div className={containerClass}>
			<div className="player-avatar">
				{avatarInitial}
			</div>
			<div className="player-meta">
				<div className="player-name">{username}</div>
				<div className={classnames("player-general", `team-${team}`)}>
				</div>
				<div className={classnames("captured-pieces", `team-${capturedTeam}`)}>
					{capturedPieces.map((symbol, index) => (
						<span className="captured-piece" key={`${capturedPieces[index]}-${index}`}>
							{pieceSymbolByType[capturedTeam][symbol]}
						</span>
					))}
				</div>
			</div>
		</div>
	)
}
