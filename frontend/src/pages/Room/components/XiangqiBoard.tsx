import React from "react"
import classnames from "classnames"
import { BOARD_COLUMNS, BOARD_ROWS } from "common/constant"
import { markerPositions } from "../variants/xiangqi/constants"
import { markerClass } from "../variants/xiangqi/rules"
import PieceItem from "./Piece"
import { BoardViewProps } from "../types"

/** The xiangqi board: a 9x10 intersection grid with palace lines and the river. */
export default function XiangqiBoard(props: BoardViewProps) {
	const {
		availableMoves,
		board,
		checkingPieces,
		currentTurn,
		isBoardRotated,
		myTeam,
		previousMove,
		selected,
		symbolOf,
		onAnimateEnd,
		onPieceClick
	} = props

	return (
		<div className="xiangqi-board">
			<div className="board-frame">
				{Array.from({ length: BOARD_ROWS - 2 }, (_, i) => i + 1).map(row => (
					<i className={`line horizontal row-${row}`} key={`h-${row}`} />
				))}

				{Array.from({ length: BOARD_COLUMNS - 2 }, (_, i) => i + 1).map(col => (
					<React.Fragment key={`v-${col}`}>
						<i className={`line vertical top col-${col}`} />
						<i className={`line vertical bottom col-${col}`} />
					</React.Fragment>
				))}
				<i className="palace-line line1" />
				<i className="palace-line line2" />
				<i className="palace-line line3" />
				<i className="palace-line line4" />

				<span className="river-text left">楚河</span>
				<span className="river-text right">漢界</span>

				{markerPositions.map(([col, row]) => (
					<div className={markerClass(col, row)} key={`marker-${col}-${row}`}>
						<i className="corner top-left" />
						<i className="corner top-right" />
						<i className="corner bottom-left" />
						<i className="corner bottom-right" />
					</div>
				))}

				{board.map((cell, id) => {
					const realCol = id % BOARD_COLUMNS
					const realRow = ~~(id / BOARD_COLUMNS)
					// Flip the view 180° while keeping the real index for all game logic.
					const col = isBoardRotated ? BOARD_COLUMNS - 1 - realCol : realCol
					const row = isBoardRotated ? BOARD_ROWS - 1 - realRow : realRow
					const isPreviousMove = (previousMove !== null
						&& (id === previousMove.from || id === previousMove.to))
						|| checkingPieces.includes(id)
					if (!cell) {
						const isAvailable = availableMoves.includes(id)
						const emptyClass = classnames({
							"piece-wrapper-empty": true,
							[`row-${row}-piece`]: true,
							[`col-${col}-piece`]: true,
							"available": isAvailable,
							"highlight": isPreviousMove,
							"cursor-pointer": isAvailable && selected !== null
						})
						return (
							<div
								key={`empty-${id}`}
								className={emptyClass}
								onClick={onPieceClick(id)}
							/>
						)
					}

					return (
						<PieceItem
							key={cell.id}
							$cell={cell}
							$left={col}
							$top={row}
							$available={availableMoves.includes(cell.id)}
							$selectedId={selected}
							$turn={currentTurn}
							$myTeam={myTeam}
							$previousMove={isPreviousMove}
							$rotated={isBoardRotated}
							$click={onPieceClick(cell.id)}
							$animateEnd={onAnimateEnd}
						>
							{cell.piece ? symbolOf(cell.piece) : ""}
						</PieceItem>
					)
				})}
			</div>
		</div>
	)
}
