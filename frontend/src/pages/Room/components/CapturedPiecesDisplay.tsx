import classnames from "classnames"
import { pieceSymbolByType } from "../constant"
import { CapturedPieces, Team } from "types/GameState"

interface CapturedPiecesDisplayProps {
	capturedPieces: CapturedPieces
	team: Team
}

export default function CapturedPiecesDisplay(props: CapturedPiecesDisplayProps) {
	const { capturedPieces, team } = props
	const capturedTeam = team === "red" ? "black" : "red"
	const capturedList = capturedPieces[team]

	const containerClass = classnames("captured-pieces-display", `team-${capturedTeam}`)

	return (
		<div className={containerClass}>
			{capturedList.map((symbol, index) => {
				const symbolText = pieceSymbolByType[symbol]
				return (
					<span
						className="captured-piece"
						key={`${symbol}-${index}`}
						data-content={symbolText}
					/>
				)
			})}
		</div>
	)
}
