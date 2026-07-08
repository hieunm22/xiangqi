import { useMemo } from "react"
import {
	Box,
	Dialog,
	DialogContent,
	DialogTitle,
	Divider,
	IconButton,
	Slider,
	Stack,
	Typography
} from "@mui/material"
import { TI } from "components/TranslationTag"
import { translate } from "locales/translate"
import { resolveSideUsers } from "pages/Room/common"
import CapturedPiecesDisplay from "pages/Room/components/CapturedPiecesDisplay"
import { RoomUser } from "pages/Room/types"
import ReplayBoard from "./components/ReplayBoard"
import ReplayPlayerCard from "./components/ReplayPlayerCard"
import useReplay from "./useReplay"
import { GameReplayPopupProps } from "./types"
import "./GameReplay.scss"

const cardTeam = (user: RoomUser | null) => (user?.team === "black" ? "black" : "red")

export const GameReplayPopup = ({ game, onClose }: GameReplayPopupProps) => {
	const open = game !== null

	const {
		board,
		capturedPieces,
		currentTurn,
		isLoading,
		isPlaying,
		previousMove,
		redFirst,
		stepIndex,
		totalMoves,

		goToStep,
		togglePlay
	} = useReplay({ gameId: game?.game.gameId ?? null, open })

	const { top, bottom } = useMemo(() => {
		if (!game) {
			return { top: null, bottom: null }
		}
		// Each player's color comes from player-history (game_users.team).
		const joinedUsers: RoomUser[] = game.users.map(user => ({
			id: user.id,
			display_name: user.display_name,
			avatar_url: user.avatar_url,
			back_ready: null,
			team: user.team,
			total_amount: 0,
			is_bot: false
		}))

		const sides = resolveSideUsers(joinedUsers, redFirst)
		// Fallback for games without a persisted color mapping: keep both players
		// visible by seating them in list order.
		if (!sides.top && !sides.bottom && joinedUsers.length === 2) {
			return { top: joinedUsers[1], bottom: joinedUsers[0] }
		}
		return sides
	}, [game, redFirst])

	const hasMoves = board.length > 0

	return (
		<Dialog
			open={open}
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

							<ReplayBoard board={board} currentTurn={currentTurn} previousMove={previousMove} />
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
