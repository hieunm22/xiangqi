import classnames from "classnames"
import styled from "styled-components"
import { BOARD_COLUMNS } from "common/constant"
import { getTeamFromPieceChar } from "../common"
import { PieceItemProps } from "../types"

const isSelected = (props: PieceItemProps) => {
	const cellTeam = getTeamFromPieceChar(props.$cell.piece)
	return cellTeam !== null && props.$turn === cellTeam && props.$selectedId === props.$cell.id
}

const isClickable = (props: PieceItemProps) => {
	// Spectators (no assigned team) can't control anything. Seated players can
	// only point at their own pieces, plus any available move target.
	if (!props.$myTeam) return false
	const cellTeam = getTeamFromPieceChar(props.$cell.piece)
	const isOwnPiece = props.$myTeam === cellTeam
	return ((props.$turn === cellTeam && isOwnPiece) || props.$available)
		&& props.$cell.animateTo === undefined
}

const getMoveTransform = (props: PieceItemProps) => {
	const targetId = props.$cell.animateTo
	if (targetId === undefined) {
		return "translate(0px, 0px)"
	}

	const fromCol = props.$cell.id % BOARD_COLUMNS
	const fromRow = ~~(props.$cell.id / BOARD_COLUMNS)
	const toCol = targetId % BOARD_COLUMNS
	const toRow = ~~(targetId / BOARD_COLUMNS)

	// get scss variable value --cell-size
	const computedStyle = getComputedStyle(document.documentElement)
	const cellSize = computedStyle.getPropertyValue("--cell-size").trim()
	const cellSizeNum = parseInt(cellSize, 10)
	const sign = props.$rotated ? -1 : 1
	const deltaX = (toCol - fromCol) * cellSizeNum * sign
	const deltaY = (toRow - fromRow) * cellSizeNum * sign

	return `translate(${deltaX}px, ${deltaY}px)`
}

const PieceWrapper = styled.div<PieceItemProps>`
	transform: ${props => getMoveTransform(props)};
	${props => isClickable(props) ? "cursor: pointer;" : ""}
	${props => isSelected(props) && props.$cell.animateTo === undefined
		? "box-shadow: 0 0 0 2px darkblue;"
		: "border: none;"}
	${props => props.$available ? "box-shadow: 0 0 0 2px #9f00ff;" : ""}
`

const PieceItem = (props: PieceItemProps) => {
	const {
		$available,
		$cell,
		children,
		$left,
		$top,
		$turn,
		$selectedId,
		$myTeam,
		$previousMove,
		$checking,
		$checkedGeneral,
		$rotated,

		$animateEnd,
		$click,
	} = props

	const cls = classnames("piece", getTeamFromPieceChar($cell.piece))
	const wrapperClass = classnames(
		"piece-wrapper",
		`row-${$top}-piece`,
		`col-${$left}-piece`,
		// Skip the highlight while selected/available so those outlines keep priority
		{
			"previous-move": $previousMove && !isSelected(props) && !$available,
			"checking": $checking && !isSelected(props) && !$available,
			"checked-general": $checkedGeneral && !isSelected(props) && !$available
		}
	)
	return (
		<PieceWrapper
			className={wrapperClass}
			$cell={$cell}
			$left={$left}
			$top={$top}
			$available={$available}
			$selectedId={$selectedId}
			$turn={$turn}
			$myTeam={$myTeam}
			$rotated={$rotated}
			onClick={$click}
			onTransitionEnd={$animateEnd}
		>
			<span className={cls}>
				{children}
			</span>
		</PieceWrapper>
	)
}

export default PieceItem
