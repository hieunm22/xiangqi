import { useMemo } from "react"
import {
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
import { TI } from "components/TranslationTag"
import { translate } from "locales/translate"
import { getRoomEngine } from "pages/Room/engine"
import ChessBoard from "pages/Room/components/ChessBoard"
import CapturedPiecesDisplay from "pages/Room/components/CapturedPiecesDisplay"
import { RoomUser } from "pages/Room/types"
import ReplayBoard from "./components/ReplayBoard"
import ReplayPlayerCard from "./components/ReplayPlayerCard"
import useReplay, { REPLAY_SPEEDS } from "./useReplay"
import { GameReplayPopupProps } from "./types"
import "./GameReplay.scss"

export const GameReplayPopup = ({ game, onClose }: GameReplayPopupProps) => {
	const open = game !== null

	const {
		board,
		capturedPieces,
		currentTurn,
		gameType,
		isLoading,
		isPlaying,
		previousMove,
		redFirst,
		stepIndex,
		stepMs,
		totalMoves,

		goToStep,
		setStepMs,
		togglePlay
	} = useReplay({ gameId: game?.game.gameId ?? null, open })

	const engine = useMemo(() => getRoomEngine(gameType), [gameType])
	// A player's card colour is the side they controlled; fall back to the seat facing
	// the board bottom so both cards stay coloured even without a persisted mapping.
	const cardTeam = (user: RoomUser | null) => user?.team ?? engine.teams[0]

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

		// Bottom seat = the side that opens; the opponent sits at the top.
		const bottomTeam = engine.firstTurn(redFirst)
		const bottomUser = joinedUsers.find(u => u.team === bottomTeam) ?? null
		const topUser = joinedUsers.find(u => u.team !== null && u.team !== bottomTeam) ?? null
		// Fallback for games without a persisted color mapping: keep both players
		// visible by seating them in list order.
		if (!topUser && !bottomUser && joinedUsers.length === 2) {
			return { top: joinedUsers[1], bottom: joinedUsers[0] }
		}
		return { top: topUser, bottom: bottomUser }
	}, [game, engine, redFirst])

	const hasMoves = board.length > 0
	const isChess = gameType === "chess"

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
									<CapturedPiecesDisplay
										capturedPieces={capturedPieces}
										team={cardTeam(top)}
										symbolOf={engine.symbolOf}
										iconGlyph={isChess}
										ownerTeam={engine.otherTeam(cardTeam(top))}
									/>
								</div>
								<div className="player-section bottom-player">
									<CapturedPiecesDisplay
										capturedPieces={capturedPieces}
										team={cardTeam(bottom)}
										symbolOf={engine.symbolOf}
										iconGlyph={isChess}
										ownerTeam={engine.otherTeam(cardTeam(bottom))}
									/>
									<ReplayPlayerCard user={bottom} active={currentTurn === bottom?.team} />
								</div>
							</div>

							{isChess ? (
								<ChessBoard
									board={board}
									availableMoves={[]}
									selected={null}
									currentTurn={currentTurn}
									myTeam={null}
									previousMove={previousMove}
									checkingPieces={[]}
									isBoardRotated={false}
									symbolOf={engine.symbolOf}
									onPieceClick={() => () => {}}
									onAnimateEnd={() => {}}
								/>
							) : (
								<ReplayBoard board={board} currentTurn={currentTurn} previousMove={previousMove} />
							)}
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
