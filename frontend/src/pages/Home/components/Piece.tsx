import classnames from "classnames"
import styled from "styled-components"
import { BOARD_COLUMNS } from "common/constant"
import { PieceItemProps } from "../types"

const isSelected = (props: PieceItemProps) => {
	return props.$turn === props.$cell.team && props.$selectedId === props.$cell.id
}

const isClickable = (props: PieceItemProps) => {
	return (props.$turn === props.$cell.team || props.$available)
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
	const deltaX = (toCol - fromCol) * cellSizeNum
	const deltaY = (toRow - fromRow) * cellSizeNum

	return `translate(${deltaX}px, ${deltaY}px)`
}

const PieceWrapper = styled.div<PieceItemProps>`
	transform: ${props => getMoveTransform(props)};
	${props => isClickable(props) ? "cursor: pointer;" : ""}
	${props => isSelected(props) && props.$cell.animateTo === undefined
		? "box-shadow: 0 0 0 2px darkblue;"
		: "border: none;"}
	${props => props.$available ? "box-shadow: 0 0 0 2px darkgreen;" : ""}
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

		$animateEnd,
		$click,
	} = props

	const cls = classnames("piece", $cell.piece, $cell.team)
	return (
		<PieceWrapper
			className={`piece-wrapper row-${$top}-piece col-${$left}-piece`}
			$cell={$cell}
			$left={$left}
			$top={$top}
			$available={$available}
			$selectedId={$selectedId}
			$turn={$turn}
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
