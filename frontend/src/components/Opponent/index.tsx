import classnames from "classnames"
import useGameToolkit from "hooks/useGameToolkit"
import { Team } from "types/GameState"
import "./Opponent.scss"

type OpponentProps = {
	team: Team
	name: string
}

const Opponent = ({ team, name }: OpponentProps) => {
	const { state } = useGameToolkit()
	const oponentTeam = team === "red" ? "black" : "red"
	const capturePiecesCls = classnames("captured-pieces", {
		black: team === "red",
		red: team === "black"
	})
	const opponentCls = classnames("opponent-container", team)

	return (
		<div className={opponentCls}>
			<div className="opponent-avatar">
				<i className="fas fa-user fa-3x" />
			</div>
			<div className="opponent-info">
				<div>{name}</div>
				<div className={capturePiecesCls}>
					{state.capturedPieces[oponentTeam].map((piece, index) => (
						<i key={index} className={`fas fa-chess-${piece} captured-piece`} />
					))}
				</div>
			</div>
		</div>
	)
}

export default Opponent
