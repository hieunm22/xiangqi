import classnames from "classnames"
import { pieceSymbolByType } from "../variants/xiangqi/constants"
import { CapturedPieces, XiangqiPieceCharacter, Team } from "types/GameState"

interface CapturedPiecesDisplayProps {
	capturedPieces: CapturedPieces
	team: Team
	// How to render a captured FEN char. For text glyphs (xiangqi) it returns the
	// glyph; for icon mode (chess) it returns a Font Awesome class
	symbolOf?: (piece: string) => string
	// Render each captured piece as a Font Awesome icon rather than a text glyph.
	iconGlyph?: boolean
	// Team that owns these captured pieces (drives the colour). Falls back to the
	// classic red/black inference when omitted.
	ownerTeam?: Team
}

const xiangqiSymbol = (piece: string) => pieceSymbolByType[piece as XiangqiPieceCharacter] ?? ""

export default function CapturedPiecesDisplay(props: CapturedPiecesDisplayProps) {
	const { capturedPieces, team, symbolOf = xiangqiSymbol, iconGlyph = false, ownerTeam } = props
	// The pieces captured *by* `team` belong to the opposing side
	const capturedTeam = ownerTeam ?? (team === "red" ? "black" : "red")
	const capturedList = capturedPieces[team] ?? []

	const containerClass = classnames("captured-pieces-display", `team-${capturedTeam}`)

	return (
		<div className={containerClass}>
			{capturedList.map((symbol, index) => {
				const rendered = symbolOf(symbol)
				return iconGlyph ? (
					<span className="captured-piece captured-piece-icon" key={`${symbol}-${index}`}>
						<i className={rendered} />
					</span>
				) : (
					<span
						className="captured-piece"
						key={`${symbol}-${index}`}
						data-content={rendered}
					/>
				)
			})}
		</div>
	)
}
