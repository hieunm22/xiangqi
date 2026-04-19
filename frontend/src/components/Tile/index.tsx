import classnames from "classnames"
import { StyledTile } from "components/Common"
import { TileContent } from "./components"
import { getAvailableMoves } from "common/helper"
import useGameToolkit from "hooks/useGameToolkit"
import { setGameState } from "toolkit/slice/game"
import { TileProps } from "./types"

const Tile = ({ element, index }: TileProps) => {
	const { state, dispatch } = useGameToolkit()

	const onSelected = async () => {
		const gameStateClone = [...state.board]
		// if no piece is selected
		if (state.selected === null || state.selected === null) {
			const availableMoves = getAvailableMoves(
				gameStateClone,
				index,
				state.teamTurn === "black" ? 1 : -1
			)
			dispatch(setGameState({
				...state,
				board: gameStateClone,
				selected: element,
				availableMoves
			}))
			return
		}

		if (
			state.selected
			&& element !== null
			&& element.team === state.selected.team
		) {
			// if the clicked tile has a piece of the same team, change selected piece
			const availableMoves = getAvailableMoves(
				gameStateClone,
				index,
				element.team === "black" ? 1 : -1
			)
			dispatch(setGameState({
				...state,
				board: gameStateClone,
				selected: element,
				availableMoves
			}))
			return
		}

		// if the clicked tile is an available move, move the piece
		if (state.availableMoves.includes(index)) {
			// check if the move is a castling move
			const isCastlingMove =
				state.selected.piece === "king" && Math.abs(state.selected.id - index) === 2
			if (isCastlingMove) {
				if (index - state.selected.id === 2) {
					if (state.selected.team === "white") {
						gameStateClone[63] = {
							id: 63,
							piece: gameStateClone[63]!.piece,
							team: gameStateClone[63]!.team,
							animateTo: 61
						}
					} else {
						gameStateClone[7] = {
							id: 7,
							piece: gameStateClone[7]!.piece,
							team: gameStateClone[7]!.team,
							animateTo: 5
						}
					}
				}
				if (index - state.selected.id === -2) {
					if (state.selected.team === "white") {
						gameStateClone[56] = {
							id: 56,
							piece: gameStateClone[56]!.piece,
							team: gameStateClone[56]!.team,
							animateTo: 59
						}
					} else {
						gameStateClone[0] = {
							id: 0,
							piece: gameStateClone[0]!.piece,
							team: gameStateClone[0]!.team,
							animateTo: 3
						}
					}
				}
			}
			const oldIndex = state.selected.id
			gameStateClone[oldIndex] = {
				id: oldIndex,
				piece: gameStateClone[oldIndex]!.piece,
				team: gameStateClone[oldIndex]!.team,
				animateTo: index
			}
			dispatch(setGameState({
				...state,
				board: gameStateClone
			}))
		} else {
			// if the clicked tile is not an available move, de-select current piece
			dispatch(setGameState({
				...state,
				selected: null,
				availableMoves: []
			}))
		}
	}

	const clsName = classnames("cell", {
		"cursor-pointer":
			(element !== null && element.team === state.teamTurn) ||
			state.availableMoves.includes(index)
	})

	const canClick =
		(element && element.team === state.teamTurn) || state.availableMoves.includes(index)

	return (
		<StyledTile
			className={clsName}
			element={element}
			$index={index}
			$selected={state.selected !== null && state.selected.id === index}
			$available={state.availableMoves.includes(index)}
			onClick={canClick ? onSelected : undefined}
		>
			<TileContent element={element} index={index} />
		</StyledTile>
	)
}

export default Tile
