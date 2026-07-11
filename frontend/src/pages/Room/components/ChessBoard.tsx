import classnames from "classnames"
import { CSSProperties } from "react"
import { teamOfChar } from "../variants/chess"
import { BoardViewProps } from "../types"
import "../ChessBoard.scss"

const COLS = 8
const ROWS = 8
const PCT = 100 / COLS // one cell as a percentage of the board (12.5%)

const visualCol = (id: number, rotated: boolean) => {
	const col = id % COLS
	return rotated ? COLS - 1 - col : col
}
const visualRow = (id: number, rotated: boolean) => {
	const row = Math.floor(id / COLS)
	return rotated ? ROWS - 1 - row : row
}

/** The chess board: an 8x8 filled-square grid. A static square layer paints the
 * checkerboard, highlights and move targets; a piece layer on top slides the
 * moving glyph via a CSS transform and fires onAnimateEnd on transition end. */
export default function ChessBoard(props: BoardViewProps) {
	const {
		availableMoves,
		board,
		checkingPieces,
		isBoardRotated,
		myTeam,
		previousMove,
		selected,
		symbolOf,
		onAnimateEnd,
		onPieceClick
	} = props

	// Positioned by percentage of the board so the layout is independent of the
	// actual cell size (which is derived from the player-info column height in CSS).
	const positionStyle = (id: number): CSSProperties => ({
		left: `${visualCol(id, isBoardRotated) * PCT}%`,
		top: `${visualRow(id, isBoardRotated) * PCT}%`
	})

	const movingTransform = (id: number, animateTo: number): CSSProperties => {
		// translate() percentages are relative to the element's own size, and a piece
		// is exactly one cell wide/tall, so one cell of travel = 100%.
		const dx = (visualCol(animateTo, isBoardRotated) - visualCol(id, isBoardRotated)) * 100
		const dy = (visualRow(animateTo, isBoardRotated) - visualRow(id, isBoardRotated)) * 100
		return { transform: `translate(${dx}%, ${dy}%)` }
	}

	return (
		<div className="chess-board">
			<div className="chess-board-frame">
				{/* Static squares: checker colours, highlights, and empty move targets. */}
				{board.map((_, id) => {
					const col = id % COLS
					const row = Math.floor(id / COLS)
					const isAvailable = availableMoves.includes(id)
					const isEmpty = !board[id]?.piece
					const isPreviousMove = (previousMove !== null
						&& (id === previousMove.from || id === previousMove.to))
					const isCheck = checkingPieces.includes(id)
					const squareClass = classnames("chess-square", {
						"light": (col + row) % 2 === 0,
						"dark": (col + row) % 2 === 1,
						"highlight": isPreviousMove,
						"check": isCheck,
						"available": isAvailable,
						"available-empty": isAvailable && isEmpty,
						"cursor-pointer": isAvailable && selected !== null
					})
					return (
						<div
							key={`sq-${id}`}
							className={squareClass}
							style={positionStyle(id)}
							onClick={onPieceClick(id)}
						/>
					)
				})}

				{/* Pieces layer: glyphs, selectable and animatable. */}
				{board.map((cell, id) => {
					if (!cell?.piece) return null
					const team = teamOfChar(cell.piece)
					const animating = cell.animateTo !== undefined
					const isSelected = selected === id && !animating
					const isOwn = myTeam != null && team === myTeam
					const pieceContainerClass = classnames("chess-piece", `team-${team}`, {
						"selected": isSelected,
						"available": availableMoves.includes(id),
						"clickable": isOwn || availableMoves.includes(id)
					})
					const pieceGlyphClass = classnames("chess-glyph", symbolOf(cell.piece))
					const style: CSSProperties = {
						...positionStyle(id),
						...(animating ? movingTransform(id, cell.animateTo!) : {})
					}
					return (
						<div
							key={`pc-${cell.id}`}
							className={pieceContainerClass}
							style={style}
							onClick={onPieceClick(id)}
							onTransitionEnd={animating ? onAnimateEnd : undefined}
						>
							<i className={pieceGlyphClass} />
						</div>
					)
				})}
			</div>
		</div>
	)
}
