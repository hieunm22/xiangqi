import React from "react"
import classnames from "classnames"
import { Stack } from "@mui/material"
import ConfettiBoom from "react-confetti-boom"
import { BOARD_COLUMNS, BOARD_ROWS } from "common/constant"
import { markerPositions, pieceSymbolByType } from "./constant"
import CapturedPiecesDisplay from "./components/CapturedPiecesDisplay"
import { GameMenu } from "./components/GameMenu"
import PieceItem from "./components/Piece"
import PlayerInfoCard from "./components/PlayerInfoCard"
import { RoomChatButton } from "./components/RoomChatButton"
import SettingsButton from "./components/SettingsButton"
import useRoomHook from "./hook"
import "./Room.scss"

export default function RoomPage() {
	const {
		availableMoves,
		board,
		bottomSideUser,
		capturedPieces,
		checkingPieces,
		currentTurn,
		gameMenuActionContextValue,
		myTeam,
		previousMove,
		roomChatDialogContextValue,
		roomSettingsDialogValue,
		selected,
		showConfetti,
		topSideUser,

		markerClass,
		onAnimateEnd,
		onPieceClick
	} = useRoomHook()

	return (
		<div className="room-container">
			{showConfetti && <ConfettiBoom mode="boom" particleCount={50} />}
			<div className="player-info-row view">
				<div className="player-section top-player">
					<PlayerInfoCard
						user={topSideUser}
						team={
							topSideUser?.team === "red" ? "red" :
								topSideUser?.team === "black" ? "black" :
									bottomSideUser?.team === "red" ? "black" : "red"
						}
						active={currentTurn === topSideUser?.team}
						roomHostId={roomSettingsDialogValue.users[0]?.id ?? null}
					/>
					<CapturedPiecesDisplay
						capturedPieces={capturedPieces}
						team={
							topSideUser?.team === "red" ? "red" :
								topSideUser?.team === "black" ? "black" :
									bottomSideUser?.team === "red" ? "black" : "red"
						}
					/>
				</div>
				<div className="player-section bottom-player">
					<CapturedPiecesDisplay
						capturedPieces={capturedPieces}
						team={bottomSideUser?.team === "black" ? "black" : "red"}
					/>
					<PlayerInfoCard
						user={bottomSideUser}
						team={bottomSideUser?.team === "black" ? "black" : "red"}
						active={currentTurn === bottomSideUser?.team}
						roomHostId={roomSettingsDialogValue.users[0]?.id ?? null}
					/>
				</div>
			</div>
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

					{board
						.map((cell, id) => {
							const col = id % BOARD_COLUMNS
							const row = ~~(id / BOARD_COLUMNS)
							const isPreviousMove = (previousMove !== null
								&& (id === previousMove.from || id === previousMove.to))
								|| checkingPieces.includes(id)
							if (!cell) {
								const isAvailable = availableMoves.includes(id)
								const emptyClass = classnames({
									"piece-wrapper-empty": true,
									[`row-${row}-piece`]: true,
									[`col-${col}-piece`]: true,
									// [`row-${row}-empty`]: true,
									// [`col-${col}-empty`]: true,
									"available": isAvailable,
									"highlight": isPreviousMove,
									// "available-empty": isAvailable,
									"cursor-pointer": isAvailable && selected !== null
								})
								return (
									<div
										key={`empty-${id}`}
										className={emptyClass}
										onClick={onPieceClick(id)}
									/>)
							}

							return (
								<PieceItem
									key={cell.id}
									$cell={cell}
									$left={col}
									$top={row}
									$available={availableMoves.includes(cell.id)}
									$selectedId={selected}
									$turn={currentTurn}
									$myTeam={myTeam}
									$previousMove={isPreviousMove}
									$click={onPieceClick(cell.id)}
									$animateEnd={onAnimateEnd}
								>
									{cell.piece ? pieceSymbolByType[cell.piece] : ""}
								</PieceItem>
							)
						})}
				</div>
			</div>
			<div className="room-action-row view">
				<GameMenu {...gameMenuActionContextValue} />
				<Stack direction={{ xs: "row", sm: "column" }} spacing={1}>
					{!roomChatDialogContextValue.pveMode && <RoomChatButton {...roomChatDialogContextValue} />}
					<SettingsButton {...roomSettingsDialogValue} />
				</Stack>
			</div>
		</div>
	)
}
