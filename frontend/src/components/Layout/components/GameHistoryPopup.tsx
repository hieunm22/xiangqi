import { useEffect, useState } from "react"
import {
	Avatar,
	Box,
	Dialog,
	DialogContent,
	DialogTitle,
	Divider,
	Paper,
	Stack,
	Tooltip,
	Typography
} from "@mui/material"
import { PopupState } from "../enums"
import { TButton } from "components/TranslationTag"
import { getToken, requireImage } from "common/helper"
import { useAPI } from "hooks/useAPI"
import useToolkit from "hooks/useToolkit"
import { translate } from "locales/translate"
import { setGameHistoryUserId, setPopup } from "toolkit/slice/home"
import { GameHistoryItem } from "../types"

interface PlayerAvatarsProps {
	game: GameHistoryItem
	userId: number
}

const PlayerAvatars = ({ game, userId: currentUserId }: PlayerAvatarsProps) => {
	const getWinnerUserId = (game: GameHistoryItem) => {
		if (game.point === 0 || !currentUserId) {
			return null
		}

		const users = game.users.slice(0, 2)
		if (users.length < 2 || !users.some(user => user.id === currentUserId)) {
			return null
		}

		if (game.point > 0) {
			return currentUserId
		}

		return users.find(user => user.id !== currentUserId)?.id ?? null
	}

	const winnerUserId = getWinnerUserId(game)

	return (
		<Stack direction="row" spacing={1} alignItems="center" justifyContent="flex-start">
			{game.users.slice(0, 2).map(user => {
				const isWinner = winnerUserId === user.id

				return (
					<Tooltip key={user.id} title={user.display_name} arrow placement="top">
						<Avatar
							src={requireImage(user.avatar_url)}
							alt={user.display_name}
							sx={{
								width: 40,
								height: 40,
								boxShadow: isWinner ? "0 0 0 2px #d0461c, 0 4px 10px rgba(0,0,0,0.25)" : "none",
								opacity: isWinner ? 1 : 0.3
							}}
						>
							{user.display_name.trim().charAt(0).toUpperCase() || "U"}
						</Avatar>
					</Tooltip>
				)
			})}
		</Stack>
	)
}

export const GameHistoryPopup = () => {
	const { state, dispatch } = useToolkit()
	const { getPlayerHistory } = useAPI()
	const [gameHistories, setGameHistories] = useState<GameHistoryItem[]>([])
	const [loading, setLoading] = useState(false)

	const handleCloseGameHistory = (_: any, reason: "backdropClick" | "escapeKeyDown" ) => {
		if (reason === "backdropClick") {
			return
		}
		dispatch(setGameHistoryUserId(null))
		dispatch(setPopup(PopupState.NONE))
	}

	useEffect(() => {
		const loadGameHistory = async () => {
			if (state.popupState !== PopupState.GAME_HISTORY) {
				return
			}

			setLoading(true)
			const token = getToken()
			if (!token) {
				setLoading(false)
				return
			}

			const response = await getPlayerHistory(token, state.gameHistoryUserId!)
			if (response?.success && response.data) {
				setGameHistories(response.data)
			}
			setLoading(false)
		}

		loadGameHistory()
	}, [state.gameHistoryUserId, state.popupState])

	const getClassNameForScore = (game: GameHistoryItem) => {
		if (game.point > 0) {
			return "game-score win"
		} else if (game.point < 0) {
			return "game-score lose"
		}
		return "game-score draw"
	}

	const formatGameDate = (date: string | Date | undefined) => {
		if (!date) return ""
		const gameDate = new Date(date)
		return gameDate.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" })
	}

	const formatGameTimeOnly = (date: string | Date | undefined) => {
		if (!date) return ""
		const gameDate = new Date(date)
		return gameDate.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
	}

	return (
		<Dialog
			open={state.popupState === PopupState.GAME_HISTORY}
			onClose={handleCloseGameHistory}
			maxWidth="sm"
			fullWidth
			disableRestoreFocus
		>
			<DialogTitle className="pt-8 pb-8">
				{translate("page.history.title")}
			</DialogTitle>
			<Divider sx={{ borderColor: "primary.main" }} />
			<DialogContent>
				{loading ? (
					<Typography>{translate("common.loading")}</Typography>
				) : gameHistories.length === 0 ? (
					<Typography>{translate("page.history.no-games")}</Typography>
				) : (
					<Stack spacing={2} className="game-history-list">
						{gameHistories.map(item => (
							<Paper
								key={item.game.gameId}
								className="game-history-item"
								variant="outlined"
							>
								<Box className="game-history-header">
									<Typography
										className="game-history-date"
										variant="caption"
										color="textPrimary"
									>
										{formatGameDate(item.game.ends_at)}
									</Typography>
									<Typography
										className="game-history-time-only"
										variant="caption"
										color="textSecondary"
									>
										{formatGameTimeOnly(item.game.ends_at)}
									</Typography>
								</Box>
								<Box className="game-history-content">
									<PlayerAvatars game={item} userId={state.gameHistoryUserId!} />
									<span className={getClassNameForScore(item)}>
										{item.point.toLocaleString(state.lang)}
									</span>
								</Box>
							</Paper>
						))}
					</Stack>
				)}
			</DialogContent>
			<Divider sx={{ borderColor: "primary.main" }} />
			<Box className="game-history-footer">
				<TButton
					variant="outlined"
					size="medium"
					onClick={() => handleCloseGameHistory(null, "escapeKeyDown")}
					value="settings.close"
				/>
			</Box>
		</Dialog>
	)
}
