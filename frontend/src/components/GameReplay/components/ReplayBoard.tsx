import React from "react"
import classnames from "classnames"
import { BOARD_COLUMNS, BOARD_ROWS } from "common/constant"
import { markerClass } from "pages/Room/common"
import {
	markerPositions,
	pieceSymbolByType
} from "pages/Room/constant"
import PieceItem from "pages/Room/components/Piece"
import { NullableCellProps, Team } from "types/GameState"
import { MoveProps } from "pages/Room/types"

interface ReplayBoardProps {
	board: NullableCellProps[]
	currentTurn: Team
	previousMove: MoveProps | null
}

const noop = () => () => {}

// Read-only reproduction of the Room board (pages/Room/index.tsx render loop) for
// replay: same grid, markers and PieceItem, but no click/selection/available-move
// interaction. Reuses Room.scss classes (imported globally by App.tsx).
const ReplayBoard = ({ board, currentTurn, previousMove }: ReplayBoardProps) => {
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
					const col = id % BOARD_COLUMNS
					const row = ~~(id / BOARD_COLUMNS)
					const isPreviousMove = previousMove !== null
						&& (id === previousMove.from || id === previousMove.to)

					if (!cell) {
						const emptyClass = classnames({
							"piece-wrapper-empty": true,
							[`row-${row}-piece`]: true,
							[`col-${col}-piece`]: true,
							"highlight": isPreviousMove
						})
						return <div key={`empty-${id}`} className={emptyClass} />
					}

					return (
						<PieceItem
							key={cell.id}
							$cell={cell}
							$left={col}
							$top={row}
							$available={false}
							$selectedId={null}
							$turn={currentTurn}
							$myTeam={null}
							$previousMove={isPreviousMove}
							$rotated={false}
							$click={noop()}
						>
							{cell.piece ? pieceSymbolByType[cell.piece] : ""}
						</PieceItem>
					)
				})}
			</div>
		</div>
	)
}

export default ReplayBoard
