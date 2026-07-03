import React from "react"
import classnames from "classnames"
import { Box, Stack } from "@mui/material"
import ConfettiBoom from "react-confetti-boom"
import landscapeBg from "../../assets/landscape.PNG?url"
import portraitBg from "../../assets/portrait.jpg?url"
import { BOARD_COLUMNS, BOARD_ROWS } from "common/constant"
import { markerPositions, pieceSymbolByType } from "./constant"
import BotDifficultyPopup from "components/BotDifficulty"
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
		capturedPieces,
		checkingPieces,
		currentTurn,
		displayTopUser,
		displayBottomUser,
		gameMenuActionContextValue,
		isBoardRotated,
		myTeam,
		previousMove,
		roomChatDialogContextValue,
		roomSettingsDialogValue,
		selected,
		showConfetti,

		markerClass,
		onAnimateEnd,
		onPieceClick,
		startGame
	} = useRoomHook()

	return (
		<Box
			className="room-container"
			sx={{
				backgroundImage: `url(${landscapeBg})`,
				"@media (max-width: 450px)": {
					backgroundImage: `url(${portraitBg})`
				}
			}}
		>
			{showConfetti && <ConfettiBoom mode="boom" particleCount={50} />}
			<div className="player-info-row view">
				<div className="player-section top-player">
					<PlayerInfoCard
						user={displayTopUser}
						team={displayTopUser?.team === "black" ? "black" : "red"}
						active={currentTurn === displayTopUser?.team}
						botLevel={displayTopUser?.is_bot ? roomSettingsDialogValue.game?.bot_difficulty ?? null : null}
						roomHostId={roomSettingsDialogValue.room?.host_id ?? null}
						roomId={roomSettingsDialogValue.room?.id ?? null}
					/>
					<CapturedPiecesDisplay
						capturedPieces={capturedPieces}
						team={displayTopUser?.team === "black" ? "black" : "red"}
					/>
				</div>
				<div className="player-section bottom-player">
					<CapturedPiecesDisplay
						capturedPieces={capturedPieces}
						team={displayBottomUser?.team === "black" ? "black" : "red"}
					/>
					<PlayerInfoCard
						user={displayBottomUser}
						team={displayBottomUser?.team === "black" ? "black" : "red"}
						active={currentTurn === displayBottomUser?.team}
						botLevel={displayBottomUser?.is_bot ? roomSettingsDialogValue.game?.bot_difficulty ?? null : null}
						roomHostId={roomSettingsDialogValue.room?.host_id ?? null}
						roomId={roomSettingsDialogValue.room?.id ?? null}
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
							const realCol = id % BOARD_COLUMNS
							const realRow = ~~(id / BOARD_COLUMNS)
							// Flip the view 180° while keeping the real index for all game logic.
							const col = isBoardRotated ? BOARD_COLUMNS - 1 - realCol : realCol
							const row = isBoardRotated ? BOARD_ROWS - 1 - realRow : realRow
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
									$rotated={isBoardRotated}
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
			<BotDifficultyPopup onConfirm={startGame} />
		</Box>
	)
}
