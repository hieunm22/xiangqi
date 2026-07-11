import { Box, Stack } from "@mui/material"
import ConfettiBoom from "react-confetti-boom"
import BoardSkeleton from "./components/BoardSkeleton"
import BotDifficultyPopup from "components/BotDifficulty"
import CapturedPiecesDisplay from "./components/CapturedPiecesDisplay"
import ChessBoard from "./components/ChessBoard"
import { GameMenu } from "./components/GameMenu"
import PlayerInfoCard from "./components/PlayerInfoCard"
import { RoomChatButton } from "./components/RoomChatButton"
import SettingsButton from "./components/SettingsButton"
import XiangqiBoard from "./components/XiangqiBoard"
import useRoomHook from "./hook"
import { BoardViewProps } from "./types"
import "./Room.scss"

export default function RoomPage() {
	const {
		availableMoves,
		board,
		capturedPieces,
		checkingPieces,
		clockDisplay,
		currentTurn,
		displayTopUser,
		displayBottomUser,
		displayTopTeam,
		displayBottomTeam,
		engine,
		game,
		gameButtons,
		isBoardRotated,
		isInGame,
		myTeam,
		previousMove,
		roomChatDialogContext,
		roomSettingsDialogValue,
		selected,
		showConfetti,

		onAnimateEnd,
		onPieceClick,
		startGame
	} = useRoomHook()

	const boardProps: BoardViewProps = {
		availableMoves,
		board,
		checkingPieces,
		currentTurn,
		isBoardRotated,
		myTeam,
		previousMove,
		selected,
		symbolOf: engine.symbolOf,
		onAnimateEnd,
		onPieceClick
	}

	return (
		<Box className="room-container">
			{showConfetti && <ConfettiBoom mode="boom" particleCount={50} />}
			<div className="player-info-row view">
				<div className="player-section top-player">
					<PlayerInfoCard
						user={displayTopUser}
						team={displayTopTeam}
						active={isInGame && currentTurn === displayTopUser?.team}
						botLevel={displayTopUser?.is_bot ? (game?.bot_difficulty ?? null) : null}
						roomHostId={roomSettingsDialogValue.room?.host_id ?? null}
						roomId={roomSettingsDialogValue.room?.id ?? null}
						remainingMs={
							clockDisplay
								? displayTopUser?.team === "black"
									? clockDisplay.blackMs
									: clockDisplay.redMs
								: null
						}
					/>
					<CapturedPiecesDisplay
						capturedPieces={capturedPieces}
						team={displayTopTeam}
						symbolOf={engine.symbolOf}
						iconGlyph={engine.gameType === "chess"}
						ownerTeam={engine.otherTeam(displayTopTeam)}
					/>
				</div>
				<div className="player-section bottom-player">
					<CapturedPiecesDisplay
						capturedPieces={capturedPieces}
						team={displayBottomTeam}
						symbolOf={engine.symbolOf}
						iconGlyph={engine.gameType === "chess"}
						ownerTeam={engine.otherTeam(displayBottomTeam)}
					/>
					<PlayerInfoCard
						user={displayBottomUser}
						team={displayBottomTeam}
						active={isInGame && currentTurn === displayBottomUser?.team}
						botLevel={displayBottomUser?.is_bot ? (game?.bot_difficulty ?? null) : null}
						roomHostId={roomSettingsDialogValue.room?.host_id ?? null}
						roomId={roomSettingsDialogValue.room?.id ?? null}
						remainingMs={
							clockDisplay
								? displayBottomUser?.team === "black"
									? clockDisplay.blackMs
									: clockDisplay.redMs
								: null
						}
					/>
				</div>
			</div>

			{board.length === 0
				? <BoardSkeleton variant={engine.gameType} />
				: engine.gameType === "chess"
					? <ChessBoard {...boardProps} />
					: <XiangqiBoard {...boardProps} />}

			<div className="room-action-row view">
				<GameMenu buttons={gameButtons} />
				<Stack direction={{ xs: "row", sm: "column" }} spacing={1}>
					{!roomChatDialogContext.pveMode && <RoomChatButton {...roomChatDialogContext} />}
					<SettingsButton {...roomSettingsDialogValue} />
				</Stack>
			</div>
			<BotDifficultyPopup onConfirm={startGame} />
		</Box>
	)
}
