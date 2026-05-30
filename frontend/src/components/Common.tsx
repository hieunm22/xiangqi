import type { ElementType } from "react"
import styled from "styled-components"
import { getTeamFromPieceChar } from "pages/Room/common"
import type { ElementWithColorType } from "types/Common"

export const Empty = () => <></>

function getTileBackgroundColor(index: number, available?: boolean) {
	if (available) {
		return "#69a36d"
	}
	if (index % 2 === 0) {
		return ~~(index / 8) % 2 === 0 ? "#dfe7ec" : "#577896"
	} else {
		return ~~(index / 8) % 2 === 0 ? "#577896" : "#dfe7ec"
	}
}

function createStyledElementWithColor<T extends ElementType>(BaseComponent: T) {
	return styled(BaseComponent)<ElementWithColorType>`
		${props => props.element?.piece ? `color: ${getTeamFromPieceChar(props.element.piece)};` : ""};
		background-color: ${props => getTileBackgroundColor(props.$index, props.$available)};
		opacity: ${props => props.$available ? 0.7 : 1};
	`
}

function createStyledElementWithBGColor<T extends ElementType>(BaseComponent: T) {
	return styled(BaseComponent)<ElementWithColorType>`
		${props => props.element?.piece ? `background-color: ${getTeamFromPieceChar(props.element.piece)};` : ""};
	`
}

export const StyledTile = createStyledElementWithColor("div")
export const StyledTurn = createStyledElementWithBGColor("span")
