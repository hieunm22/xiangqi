import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
	Box,
	Button,
	Grid,
	Skeleton,
	Stack
} from "@mui/material"
import { LOGIN_PATH } from "common/constant"
import Alert from "components/AlertWithIcon"
import { FILTER_KEYS, FILTER_STATUS } from "./constants"
import { TTypography } from "components/TranslationTag"
import { CreateRoomCard } from "./components/CreateRoomCard"
import { RoomCard } from "./components/RoomCard"
import { CreateRoomDialog, CreateRoomDialogContext } from "./components/CreateRoomDialog"
import { getToken } from "common/helper"
import { translate } from "locales/translate"
import useAutoTitle from "hooks/useAutoTitle"
import { useAPI } from "hooks/useAPI"
import {
	DashboardFilter,
	DashboardRoom,
	FetchRoomsResponse
} from "./types"
import "./Dashboard.scss"

const DashboardPage = () => {
	useAutoTitle("dashboard.page.title")
	const { fetchRooms } = useAPI()
	const navigate = useNavigate()
	const [activeFilter, setActiveFilter] = useState<DashboardFilter>("all")
	const [rooms, setRooms] = useState<DashboardRoom[]>([])
	const [loading, setLoading] = useState(true)
	const [errorMessage, setErrorMessage] = useState("")
	const [open, setOpen] = useState(false)
	const loadingCards = Array.from({ length: 9 }, (_, i) => i)

	useEffect(() => {
		const token = getToken()
		if (!token) {
			navigate(LOGIN_PATH)
			return
		}
		
		// TODO
	}, [])

	useEffect(() => {
		let ignore = false

		const loadRooms = async () => {
			setLoading(true)
			setErrorMessage("")

			const token = getToken()

			const response = await fetchRooms(
				token,
				activeFilter === "all" ? undefined : FILTER_STATUS[activeFilter]
			) as FetchRoomsResponse

			if (ignore) {
				return
			}

			if (!response?.success) {
				setRooms([])
				setErrorMessage(response?.message || translate("dashboard.feedback.error"))
				setLoading(false)
				return
			}

			setRooms(response.rooms || [])
			setLoading(false)
		}

		loadRooms()

		return () => {
			ignore = true
		}
	}, [activeFilter])

	return (
		<CreateRoomDialogContext.Provider value={{ open, setOpen }}>
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
						<Grid container spacing={2}>
							{loadingCards.map(card => (
								<Grid key={`loading-card-${card}`} size={{ xs: 6, sm: 4, md: 4 }} className="dashboard__room-card">
									<Stack spacing={1.5}>
										<Skeleton variant="text" height={32} width="100%" />
										<Stack direction="row" justifyContent="space-between" alignItems="center">
											<Skeleton variant="text" height={28} width={88} />
											<Skeleton variant="circular" width={28} height={28} />
										</Stack>
										<Skeleton variant="rounded" height={28} width="100%" />
									</Stack>
								</Grid>
							))}
						</Grid>
					) : null}

					{!loading && !errorMessage ? (
						<Stack spacing={2}>
							<Grid container spacing={2}>
								{<CreateRoomCard click={() => setOpen(true)} />}
								{rooms.map(room => <RoomCard key={room.id} room={room} />)}
							</Grid>

							{rooms.length === 0 && (
								<Alert severity="info"> {translate("dashboard.feedback.empty")} </Alert>
							)}
						</Stack>
					) : null}
				</Stack>

				<CreateRoomDialog />
			</Box>
		</CreateRoomDialogContext.Provider>
	)
}

export default DashboardPage
