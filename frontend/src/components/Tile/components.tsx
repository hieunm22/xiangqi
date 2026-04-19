import { Empty, StyledPiece } from "components/Common"
import { translate } from "locales/translate"
import { initNewGame } from "common/helper"
import useGameToolkit from "hooks/useGameToolkit"
import { setGameState } from "toolkit/slice/game"
import { TileProps } from "./types"

export const TileContent = (props: TileProps) => {
	const { state, dispatch } = useGameToolkit()
	const { element, index } = props

	const onAnimateEnd = async () => {
		const gameStateClone = [...state.board]
		const capturedPiecesClone = { ...state.capturedPieces }
		for (const cell of gameStateClone) {
			if (!cell) continue
			if (cell.animateTo !== undefined) {
				// handle en passant capture for pawns
				const diff = cell.animateTo - cell.id
				if (
					gameStateClone[cell.id]?.piece === "pawn" &&
					gameStateClone[cell.id + diff] === null // destination cell is empty
				) {
					const isLeftCapture =
						(diff === -9 || diff === 7) &&
						gameStateClone[cell.id - 1]?.piece === "pawn" &&
						gameStateClone[cell.id - 1]?.team !== gameStateClone[cell.id]?.team
					const isRightCapture =
						(diff === -7 || diff === 9) &&
						gameStateClone[cell.id + 1]?.piece === "pawn" &&
						gameStateClone[cell.id + 1]?.team !== gameStateClone[cell.id]?.team

					let id = -1

					if (isLeftCapture || isRightCapture) {
						if (isLeftCapture) id = cell.id - 1
						if (isRightCapture) id = cell.id + 1
						gameStateClone[id] = null
					}
				}
				const isPawnDoubleStep =
					[16, -16].includes(cell.animateTo - cell.id) &&
					gameStateClone[cell.id]?.piece === "pawn"
				const destinationCell = gameStateClone[cell.animateTo]
				if (destinationCell && destinationCell.team !== cell.team) {
					// capture the piece and update captured pieces list
					capturedPiecesClone[destinationCell.team] = [
						...capturedPiecesClone[destinationCell.team],
						destinationCell.piece
					]
					if (destinationCell.piece === "king") {
						const restart = confirm(translate("game.king.captured"))
						if (restart) {
							const gameState = initNewGame()
							dispatch(setGameState(gameState))
							return
						}
					}
				}
				gameStateClone[cell.animateTo] = {
					id: cell.animateTo,
					piece: cell.piece,
					team: cell.team,
					...(isPawnDoubleStep ? { canBeEnPassant: true } : {})
				}
				// old position becomes empty
				gameStateClone[cell.id] = null
			}
		}
		const toIdx = element!.animateTo!
		const isPromotion = state.selected?.piece === "pawn" && (toIdx < 8 || toIdx >= 56)
		if (isPromotion) {
			const newPieceName = isPromotion ? "queen" : state.selected!.piece
			gameStateClone[toIdx] = {
				id: toIdx,
				piece: newPieceName,
				team: state.selected!.team
			}
		}
		// remove canBeEnPassant flag of opponent's pawns after one turn
		for (let i = 0; i < gameStateClone.length; i++) {
			const cell = gameStateClone[i]
			if (!cell) continue
			if (cell.canBeEnPassant && cell.team !== state.teamTurn) {
				const { canBeEnPassant, ...nextCell } = cell
				if (canBeEnPassant) {
					gameStateClone[i] = nextCell
				}
			}
		}

		dispatch(setGameState({
			board: gameStateClone,
			selected: null,
			availableMoves: [],
			teamTurn: state.teamTurn === "white" ? "black" : "white",
			capturedPieces: capturedPiecesClone
		}))
	}

	let pieceClass = "piece"
	if (element !== null) {
		pieceClass += ` fas fa-chess-${element.piece}`
		if (element.team === "white") {
			pieceClass += " with-border"
		}
	}

	if (state.selected && element && element.animateTo !== undefined) {
		const dx = (element.animateTo % 8) - (index % 8)
		const dy = ~~(element.animateTo / 8) - ~~(index / 8)
		return (
			<StyledPiece
				className={pieceClass}
				$move
				$dx={dx}
				$dy={dy}
				onTransitionEnd={onAnimateEnd}
			/>
		)
	}

	if (element !== null) {
		return (
			<StyledPiece
				className={pieceClass}
				$move={false}
				$dx={0}
				$dy={0}
				onTransitionEnd={onAnimateEnd}
			/>
		)
	}

	return <Empty />
}
