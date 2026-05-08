import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
	Alert,
	Box,
	Button,
	CircularProgress,
	Grid,
	Stack
} from "@mui/material"
import { LOGIN_PATH } from "common/constant"
import { FILTER_KEYS, FILTER_STATUS } from "./constants"
import { TTypography } from "components/TranslationTag"
import { CreateGameCard } from "./components/CreateGameCard"
import { GameCard } from "./components/GameCard"
import { CreateGameDialog, CreateGameDialogContext } from "./components/CreateGameDialog"
import { getToken, initNewGame } from "common/helper"
import { translate } from "locales/translate"
import useAutoTitle from "hooks/useAutoTitle"
import { useAPI } from "hooks/useAPI"
import useGameToolkit from "hooks/useGameToolkit"
import { setGameState } from "toolkit/slice/game"
import {
	DashboardFilter,
	DashboardGame,
	FetchGamesResponse
} from "./types"
import "./Dashboard.scss"

const DashboardPage = () => {
	useAutoTitle("dashboard.page.title")
	const { dispatch } = useGameToolkit()
	const { fetchGames } = useAPI()
	const navigate = useNavigate()
	const [activeFilter, setActiveFilter] = useState<DashboardFilter>("all")
	const [games, setGames] = useState<DashboardGame[]>([])
	const [loading, setLoading] = useState(true)
	const [errorMessage, setErrorMessage] = useState("")
	const [open, setOpen] = useState(false)

	useEffect(() => {
		const token = getToken()
		if (!token) {
			navigate(LOGIN_PATH)
			return
		}

		// Initialize game state when entering dashboard
		const init = initNewGame()
		dispatch(setGameState(init))
	}, [dispatch, navigate])

	useEffect(() => {
		let ignore = false

		const loadGames = async () => {
			setLoading(true)
			setErrorMessage("")

			const token = getToken()

			const response = await fetchGames(
				token,
				activeFilter === "all" ? undefined : FILTER_STATUS[activeFilter]
			) as FetchGamesResponse

			if (ignore) {
				return
			}

			if (!response?.success) {
				setGames([])
				setErrorMessage(response?.message || translate("dashboard.feedback.error"))
				setLoading(false)
				return
			}

			setGames(response.games || [])
			setLoading(false)
		}

		loadGames()

		return () => {
			ignore = true
		}
	}, [activeFilter])

	return (
		<CreateGameDialogContext.Provider value={{ open, setOpen }}>
			<Box className="dashboard">
			<Stack spacing={3}>
				<TTypography
					variant="h5"
					fontWeight={700}
					gutterBottom
					content="dashboard.page.title"
				/>

				<Stack direction="row" spacing={1.5} flexWrap="wrap">
					{(["all", "available", "playing"] as DashboardFilter[]).map(filter => (
							<Button
								key={filter}
								onClick={() => setActiveFilter(filter)}
								variant={filter === activeFilter ? "contained" : "outlined"}
								size="medium"
								className="dashboard__filter-btn"
								sx={{ boxShadow: filter === activeFilter ? 0 : 2 }}
							>
								{translate(FILTER_KEYS[filter])}
							</Button>
						)
					)}
				</Stack>

				{errorMessage && <Alert severity="error">{errorMessage}</Alert>}

				{loading ? (
					<Box className="dashboard__loading">
						<CircularProgress />
					</Box>
				) : null}

				{!loading && !errorMessage ? (
					<Stack spacing={2}>
						<Grid container spacing={2}>
							{<CreateGameCard click={() => setOpen(true)} />}
							{games.map(game => <GameCard key={game.id} game={game} />)}
						</Grid>

						{games.length === 0 && (
							<Alert severity="info"> {translate("dashboard.feedback.empty")} </Alert>
						)}
					</Stack>
				) : null}
			</Stack>

				<CreateGameDialog />
			</Box>
		</CreateGameDialogContext.Provider>
	)
}

export default DashboardPage
