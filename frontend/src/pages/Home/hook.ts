import { useEffect } from "react"
import classnames from "classnames"
import {
	BOARD_COLUMNS,
	LS_BOARD,
	LS_CAPTURED_PIECES,
	LS_TURN
} from "common/constant"
import { openAlert } from "components/AlertProvider"
import { openConfirm } from "components/ConfirmProvider"
import { getAvailableMoves, initNewGame, isGeneralInCheck } from "common/helper"
import { translate } from "locales/translate"
import { setGameState } from "toolkit/slice/game"
import useAutoTitle from "hooks/useAutoTitle"
import useGameToolkit from "hooks/useGameToolkit"
import { Team } from "types/GameState"

const useHomeHook = () => {
	useAutoTitle("page.home.title")
	const { state, dispatch } = useGameToolkit()
	const getStoredTurn = () => (localStorage.getItem(LS_TURN) as Team) || "red"
	
	useEffect(() => {
		const currentTurn = getStoredTurn()
		const savedBoard = localStorage.getItem(LS_BOARD)
		const capturedPieces = localStorage.getItem(LS_CAPTURED_PIECES) || "{\"red\":[],\"black\":[]}"
		dispatch(setGameState({
			availableMoves: [],
			board: JSON.parse(savedBoard!),
			selected: null,
			teamTurn: currentTurn,
			capturedPieces: JSON.parse(capturedPieces)
		}))
	}, [])

	useEffect(() => {
		if (getStoredTurn() !== state.teamTurn) {
			localStorage.setItem(LS_TURN, state.teamTurn)
		}
	}, [state.teamTurn])

	useEffect(() => {
		localStorage.setItem(LS_BOARD, JSON.stringify(state.board))
	}, [state.board])

	useEffect(() => {
		localStorage.setItem(LS_CAPTURED_PIECES, JSON.stringify(state.capturedPieces))
	}, [state.capturedPieces])
	
	const markerClass = (col: number, row: number) => classnames("marker", {
		"left-edge": col === 0,
		"right-edge": col === BOARD_COLUMNS - 1,
		[`row-${row} col-${col}`]: true,
	})

	const onPieceClick = (id: number) => () => {
		const currentTurn = state.teamTurn
		if (getStoredTurn() !== currentTurn) {
			localStorage.setItem(LS_TURN, currentTurn)
		}
		if (currentTurn !== state.board[id]?.team && !state.availableMoves.includes(id)) {
			return
		}

		// Click on an available move
		if (state.availableMoves.includes(id)) {
			const gameStateClone = [...state.board]
			const oldIndex = state.selected!
			gameStateClone[oldIndex] = {
				id: oldIndex,
				piece: gameStateClone[oldIndex]!.piece,
				team: gameStateClone[oldIndex]!.team,
				animateTo: id
			}

			dispatch(setGameState({
				...state,
				board: gameStateClone
			}))
			return
		}
		const selected = state.selected === id ? null : id
		const availableMoves = getAvailableMoves(state.board, selected, currentTurn === "red" ? -1 : 1)
		dispatch(setGameState({
			...state,
			availableMoves,
			selected
		}))
	}

	const onAnimateEnd = async () => {
		const gameStateClone = [...state.board]
		const selectedId = state.selected!
		const targetId = gameStateClone[selectedId]!.animateTo!
		const oldTarget = gameStateClone[targetId]
		const movedTeam = gameStateClone[selectedId]!.team

		// Create new board state with the move applied
		gameStateClone[targetId] = {
			id: targetId,
			piece: gameStateClone[selectedId]!.piece,
			team: movedTeam,
		}
		gameStateClone[selectedId] = null

		// Check if this move puts the moving team's general in check
		const isMovedTeamGeneralInCheck = isGeneralInCheck(gameStateClone, movedTeam)

		if (isMovedTeamGeneralInCheck) {
			// Revert the move if it puts general in check - restore original board state
			const revertedBoard = [...state.board]
			revertedBoard[selectedId] = {
				id: selectedId,
				piece: revertedBoard[selectedId]!.piece,
				team: revertedBoard[selectedId]!.team,
			}
			
			await openAlert({
				title: "popup.alert.title",
				message: "game.general.in-check"
			})
			
			dispatch(setGameState({
				...state,
				board: revertedBoard,
				availableMoves: [],
				selected: null
			}))
			return
		}

		// Move is valid, commit it
		const capturedPiecesClone = structuredClone(state.capturedPieces)
		if (oldTarget && oldTarget.team !== movedTeam) {
			capturedPiecesClone[movedTeam].push(oldTarget.piece)
		}

		const enemyTeam = movedTeam === "red" ? "black" : "red"
		dispatch(setGameState({
			...state,
			availableMoves: [],
			capturedPieces: capturedPiecesClone,
			board: gameStateClone,
			selected: null,
			teamTurn: enemyTeam
		}))

		if (oldTarget?.piece === "general") {
			openConfirm({
				message: translate("game.general.captured"),
				title: translate("popup.alert.title"),
				onOk: onOkConfirm
			})
		}
	}

	const onOkConfirm = () => {
		const init = initNewGame()
		dispatch(setGameState(init))
	}

	return {
		state,

		markerClass,
		onPieceClick,
		onAnimateEnd
	}
}

export default useHomeHook