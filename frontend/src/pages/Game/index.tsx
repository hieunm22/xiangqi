import React, { useMemo } from "react"
import { useNavigate, useParams } from "react-router-dom"
import classnames from "classnames"
import { BOARD_COLUMNS, BOARD_ROWS } from "common/constant"
import { markerPositions, pieceSymbolByType } from "./constant"
import { TButton } from "components/TranslationTag"
import { openConfirm } from "components/ConfirmProvider"
import PieceItem from "./components/Piece"
import PlayerInfoCard from "./components/PlayerInfoCard"
import { decodePayload, getToken } from "common/helper"
import useHomeHook from "./hook"
import { useAPI } from "hooks/useAPI"
import { Piece } from "types/GameState"
import "./Game.scss"

export default function GamePage() {
	const navigate = useNavigate()
	const { id: gameId } = useParams()

	const {
		gameStatus,
		joinedUsers,
		state,

		markerClass,
		onPieceClick,
		onAnimateEnd
	} = useHomeHook()

	const { leaveGame } = useAPI()

	const currentUserId = useMemo(() => {
		const token = getToken()
		const payload = decodePayload(token)
		const id = Number(payload?.sub)
		return Number.isNaN(id) ? null : id
	}, [])

	const playerIds = joinedUsers.slice(0, 2).map(user => Number(user.id))
	const firstJoinedUser = joinedUsers[0]
	const secondJoinedUser = joinedUsers[1]
	const isInCurrentGame = currentUserId !== null && joinedUsers.some(user => Number(user.id) === currentUserId)
	const isFirstJoinedPlayer = currentUserId !== null && playerIds[0] === currentUserId
	const isPlayer = currentUserId !== null && playerIds.includes(currentUserId)

	const handleStartGame = async () => {
		if (!isFirstJoinedPlayer) {
			return
		}

		// TODO: Call API to update game status from 1 -> 2
	}

	const handleSurrender = async () => {
		if (!isPlayer || gameStatus !== 2) {
			return
		}

		// TODO: Implement surrender API logic
	}

	const leaveCurrentGame = async () => {
		const token = getToken()
		if (!token || !gameId) {
			navigate("/")
			return
		}

		await leaveGame(token, gameId)
		navigate("/")
	}

	const handleBackToHome = async () => {
		if (!isInCurrentGame) {
			return
		}

		if (isPlayer) {
			const confirmed = await openConfirm({
				title: "popup.confirm.title",
				message: "Bạn có chắc muốn rời bàn chơi?"
			})
			if (!confirmed) {
				return
			}
		}

		await leaveCurrentGame()
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
									// [`row-${row}-empty`]: true,
									// [`col-${col}-empty`]: true,
									"available": isAvailable,
									// "available-empty": isAvailable,
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
					username={firstJoinedUser?.display_name || "Waiting player..."}
					team={firstJoinedUser?.team === "red" ? "red" : "black"}
					avatarUrl={firstJoinedUser?.avatar_url || null}
					capturedPieces={state.capturedPieces.black}
				/>
				<PlayerInfoCard
					username={secondJoinedUser?.display_name || "Waiting player..."}
					team={secondJoinedUser?.team === "black" ? "black" : "red"}
					avatarUrl={secondJoinedUser?.avatar_url || null}
					capturedPieces={state.capturedPieces.red}
					mirrored
				/>
			</div>
			<div className="game-action-row">
				<TButton
					variant="contained"
					size="medium"
					color="success"
					onClick={handleStartGame}
					sx={{ visibility: isFirstJoinedPlayer ? "visible" : "hidden" }}
					value="game.actions.start-game"
				/>
				<TButton
					variant="contained"
					size="medium"
					color="warning"
					onClick={handleSurrender}
					sx={{ visibility: isPlayer && gameStatus === 2 ? "visible" : "hidden" }}
					value="game.actions.surrender"
				/>
				<TButton
					variant="contained"
					size="medium"
					color="error"
					onClick={handleBackToHome}
					sx={{ visibility: isInCurrentGame ? "visible" : "hidden" }}
					value="game.actions.back-home"
				/>
			</div>
		</div>
	)
}
