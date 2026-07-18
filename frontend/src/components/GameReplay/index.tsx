import {
	Avatar,
	Box,
	Dialog,
	DialogContent,
	DialogTitle,
	Divider,
	IconButton,
	MenuItem,
	Select,
	Slider,
	Stack,
	Typography
} from "@mui/material"
import { openAlert } from "components/AlertProvider/helper"
import { TI } from "components/TranslationTag"
import CapturedPiecesDisplay from "pages/Room/components/CapturedPiecesDisplay"
import ReplayBoard from "./components/ReplayBoard"
import ReplayPlayerCard from "./components/ReplayPlayerCard"
import { requireImage } from "common/helper"
import { translate } from "locales/translate"
import { RoomUser } from "pages/Room/types"
import useReplay, { REPLAY_SPEEDS } from "./useReplay"
import { GameReplayPopupProps, ReplayEndInfo } from "./types"
import "./GameReplay.scss"

const cardTeam = (user: RoomUser | null) => (user?.team === "black" ? "black" : "red")

// Reasons whose message names a specific player (interpolated via {{name}}).
const NAME_REASONS = [
	"surrender",
	"leave",
	"timeout",
	"per-move-timeout",
	"checkmate",
	"perpetual-check"
]
// Reasons with a fixed message and no player name.
const PLAIN_REASONS = ["stalemate", "draw"]

const handleReplayEnd = ({ reason, playerName, playerAvatar }: ReplayEndInfo) => {
	if (reason && playerName && NAME_REASONS.includes(reason)) {
		const avatar = playerAvatar ? (
			<Avatar
				className="alert-message-avatar"
				sx={{ width: 32, height: 32 }}
				src={requireImage(playerAvatar ?? "")}
			/>
		) : undefined
		openAlert({
			title: "page.replay.end-title",
			message: translate(`page.replay.reason-${reason}`, { name: playerName }),
			icon: avatar
		})
		return
	}
	const message = reason && PLAIN_REASONS.includes(reason)
		? translate(`page.replay.reason-${reason}`)
		: translate("page.replay.reason-ended")
	openAlert({ title: "page.replay.end-title", message })
}

export const GameReplayPopup = ({ game, onClose }: GameReplayPopupProps) => {
	const {
		board,
		bottom,
		capturedPieces,
		checkingPieces,
		currentTurn,
		isLoading,
		isPlaying,
		previousMove,
		stepIndex,
		stepMs,
		top,
		totalMoves,

		goToStep,
		setStepMs,
		togglePlay
	} = useReplay({ game, onEnd: handleReplayEnd })

	const hasMoves = board.length > 0

	return (
		<Dialog
			open={game !== null}
			onClose={onClose}
			fullScreen
			disableEnforceFocus
			disableRestoreFocus
		>
			<DialogTitle className="game-replay-title">
				<span>{translate("page.replay.title")}</span>
				<IconButton onClick={onClose} size="small" aria-label={translate("settings.close")}>
					<TI className="fas fa-times" />
				</IconButton>
			</DialogTitle>
			<Divider sx={{ borderColor: "primary.main" }} />
			<DialogContent className="game-replay-content no-padding">
				{isLoading ? (
					<Typography>{translate("common.loading")}</Typography>
				) : !hasMoves ? (
					<Typography>{translate("page.replay.no-moves")}</Typography>
				) : (
					<Box className="game-replay-wrapper">
						<Box className="game-replay-body">
							<div className="player-info-row view">
								<div className="player-section top-player">
									<ReplayPlayerCard user={top} active={currentTurn === top?.team} />
									<CapturedPiecesDisplay capturedPieces={capturedPieces} team={cardTeam(top)} />
								</div>
								<div className="player-section bottom-player">
									<CapturedPiecesDisplay capturedPieces={capturedPieces} team={cardTeam(bottom)} />
									<ReplayPlayerCard user={bottom} active={currentTurn === bottom?.team} />
								</div>
							</div>

							<ReplayBoard
								board={board}
								checkingPieces={checkingPieces}
								currentTurn={currentTurn}
								previousMove={previousMove}
							/>
						</Box>

						<Stack direction="row" className="game-replay-controls">
							<IconButton
								className="game-replay-play"
								onClick={togglePlay}
								disabled={totalMoves === 0}
								aria-label={translate(isPlaying ? "page.replay.pause" : "page.replay.play")}
							>
								<TI className={isPlaying ? "fas fa-pause" : "fas fa-play"} />
							</IconButton>
							<Select
								className="game-replay-speed"
								value={stepMs}
								onChange={e => setStepMs(Number(e.target.value))}
								size="small"
								variant="standard"
							>
								{REPLAY_SPEEDS.map(speed => (
									<MenuItem key={speed.value} value={speed.value}>
										{speed.label}
									</MenuItem>
								))}
							</Select>
							<Slider
								className="game-replay-slider"
								value={stepIndex}
								min={0}
								max={totalMoves}
								step={1}
								onChange={(_, value) => goToStep(value as number)}
							/>
							<Typography className="game-replay-progress">
								{stepIndex} / {totalMoves}
							</Typography>
						</Stack>
					</Box>
				)}
			</DialogContent>
		</Dialog>
	)
}
