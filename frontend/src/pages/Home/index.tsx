import React, { useEffect } from "react"
import classnames from "classnames"
import {
	BOARD_COLUMNS,
	BOARD_ROWS,
	LS_BOARD,
	LS_CAPTURED_PIECES,
	LS_TURN
} from "common/constant"
import { markerPositions, pieceSymbolByType } from "./constant"
import { openAlert } from "components/AlertProvider"
import { openConfirm } from "components/ConfirmProvider"
import PieceItem from "./components/Piece"
import { getAvailableMoves, initNewGame, isGeneralInCheck } from "common/helper"
import { translate } from "locales/translate"
import { setGameState } from "toolkit/slice/game"
import useAutoTitle from "hooks/useAutoTitle"
import useGameToolkit from "hooks/useGameToolkit"
import PlayerInfoCard from "./components/PlayerInfoCard"
import { Piece, Team } from "types/GameState"
import "./Home.scss"

export default function HomePage() {
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

		dispatch(setGameState({
			...state,
			availableMoves: [],
			capturedPieces: capturedPiecesClone,
			board: gameStateClone,
			selected: null,
			teamTurn: state.teamTurn === "red" ? "black" : "red"
		}))

		if (oldTarget?.piece === "general") {
			openConfirm({
				message: translate("game.general.captured"),
				title: "Game Over",
				onOk: onOkConfirm
			})
		}
	}

	const onOkConfirm = () => {
		const init = initNewGame()
		dispatch(setGameState(init))
	}

	return (
		<div className="game-container">
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

					{state.board
						.map((cell, id) => {
							const col = id % BOARD_COLUMNS
							const row = ~~(id / BOARD_COLUMNS)
							if (!cell) {
								const isAvailable = state.availableMoves.includes(id)
								const emptyClass = classnames({
									"piece-wrapper-empty": true,
									[`row-${row}-piece`]: true,
									[`col-${col}-piece`]: true,
									"available": isAvailable,
									"cursor-pointer": isAvailable && state.selected !== null
								})
								return (
									<div
										key={`empty-${id}`}
										className={emptyClass}
										onClick={onPieceClick(id)}
									/>)
							}

							const piece = cell.piece as Piece

							return (
								<PieceItem
									key={cell.id}
									$cell={cell}
									$left={col}
									$top={row}
									$available={state.availableMoves.includes(cell.id)}
									$selectedId={state.selected}
									$turn={state.teamTurn}
									$click={onPieceClick(cell.id)}
									$animateEnd={onAnimateEnd}
								>
									{pieceSymbolByType[cell.team][piece]}
								</PieceItem>
							)
						})}
				</div>
			</div>
			<div className="player-info-row">
				<PlayerInfoCard
					username="Black"
					team="black"
					capturedPieces={state.capturedPieces.black}
				/>
				<PlayerInfoCard
					username="Red"
					team="red"
					capturedPieces={state.capturedPieces.red}
					mirrored
				/>
			</div>
		</div>
	)
}
