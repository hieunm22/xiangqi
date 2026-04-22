import React, { useEffect } from "react"
import classnames from "classnames"
import {
	BOARD_COLUMNS,
	BOARD_ROWS,
	LS_BOARD,
	LS_CAPTURED_PIECES,
	LS_TURN
} from "common/constant"
import { pieceSymbolByType } from "./constant"
import PieceItem from "./components/Piece"
import { getAvailableMoves } from "common/helper"
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
	
	const markerPositions: Array<[number, number]> = [
		[1, 2],
		[7, 2],
		[0, 3],
		[2, 3],
		[4, 3],
		[6, 3],
		[8, 3],
		[0, 6],
		[2, 6],
		[4, 6],
		[6, 6],
		[8, 6],
		[1, 7],
		[7, 7],
	]

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

	const onAnimateEnd = () => {
		const gameStateClone = [...state.board]
		const selectedId = state.selected!
		const targetId = gameStateClone[selectedId]!.animateTo!
		const oldTarget = gameStateClone[targetId]
		const capturedPiecesClone = structuredClone(state.capturedPieces)
		if (oldTarget && oldTarget.team !== gameStateClone[selectedId]!.team) {
			const team = gameStateClone[selectedId]!.team
			capturedPiecesClone[team].push(oldTarget.piece)
		}
		gameStateClone[targetId] = {
			id: targetId,
			piece: gameStateClone[selectedId]!.piece,
			team: gameStateClone[selectedId]!.team,
		}
		gameStateClone[selectedId] = null
		dispatch(setGameState({
			...state,
			availableMoves: [],
			capturedPieces: capturedPiecesClone,
			board: gameStateClone,
			selected: null,
			teamTurn: state.teamTurn === "red" ? "black" : "red"
		}))
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
