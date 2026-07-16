import { useEffect, useState } from "react"
import {
	Box,
	Grid,
	Stack
} from "@mui/material"
import Alert from "components/AlertWithIcon"
import { FILTER_KEYS, FILTER_STATUS } from "./constants"
import { CreateRoomCard } from "./components/CreateRoomCard"
import { CreateRoomDialog } from "./components/CreateRoomDialog"
import { RoomCard } from "./components/RoomCard"
import { SkeletonRoom } from "./components/SkeletonRoom"
import { TButton, TSpan } from "components/TranslationTag"
import { getToken } from "common/helper"
import { useAPI } from "hooks/useAPI"
import { CreateRoomDialogContext } from "hooks/useAppContext"
import { useProfilePopup } from "hooks/useAppContext"
import useAutoTitle from "hooks/useAutoTitle"
import { useSocket } from "hooks/useSocket"
import { translate } from "locales/translate"
import { APIResponse } from "types/Common"
import { DashboardFilter, DashboardRoom } from "./types"
import "./Dashboard.scss"
import useToolkit from "hooks/useToolkit"
import { setCurrentRoomId, setIsCurrentRoomPlayer } from "toolkit/slice/game"

const DashboardPage = () => {
	useAutoTitle("dashboard.page.title")
	const { fetchRooms } = useAPI()
	const { profileUser } = useProfilePopup()
	const {
		isConnected,
		offRoomCreated,
		offRoomDeleted,
		offDashboardRoomUsersUpdated,
		onDashboardRoomUsersUpdated,
		onRoomCreated,
		onRoomDeleted,
	} = useSocket()
	const [activeFilter, setActiveFilter] = useState<DashboardFilter>("all")
	const [rooms, setRooms] = useState<DashboardRoom[]>([])
	const [loading, setLoading] = useState(true)
	const [errorMessage, setErrorMessage] = useState("")
	const [open, setOpen] = useState(false)
	const loadingCards = Array.from({ length: 9 }, (_, i) => i)
	const { dispatch } = useToolkit()

	// Detect if current user is in any room
	useEffect(() => {
		if (!profileUser?.id) {
			dispatch(setCurrentRoomId(null))
			dispatch(setIsCurrentRoomPlayer(false))
			return
		}

		const currentRoom = rooms.find(room =>
			room.users.some(user => user.id === profileUser.id)
		)
		const userRoomId = currentRoom ? currentRoom.id : null
		const roomUser = currentRoom?.users.find(user => user.id === profileUser.id) ?? null
		const isCurrentRoomPlayer = roomUser?.team != null

		dispatch(setCurrentRoomId(userRoomId))
		dispatch(setIsCurrentRoomPlayer(isCurrentRoomPlayer))
	}, [rooms])

	useEffect(() => {
		let ignore = false

		async function loadRooms() {
			setLoading(true)
			setErrorMessage("")

			const token = getToken()

			const response = await fetchRooms(
				token,
				activeFilter === "all" ? undefined : FILTER_STATUS[activeFilter]
			) as APIResponse<DashboardRoom[]>

			if (ignore) {
				return
			}

			if (!response?.success) {
				setRooms([])
				setErrorMessage(response?.message || translate("dashboard.feedback.error"))
				setLoading(false)
				return
			}

			setRooms(response.data || [])
			setLoading(false)
		}

		loadRooms()

		return () => {
			ignore = true
		}
	}, [activeFilter])

	useEffect(() => {
		if (!isConnected) {
			return
		}

		const shouldIncludeByFilter = (status: number) => {
			if (activeFilter === "all") {
				return true
			}

			return FILTER_STATUS[activeFilter] === status
		}

		const handleRoomCreated = (data: { room?: DashboardRoom }) => {
			const newRoom = data?.room
			if (!newRoom || typeof newRoom.id !== "number") {
				return
			}

			if (!shouldIncludeByFilter(newRoom.status)) {
				return
			}

			setRooms(prev => {
				const withoutExisting = prev.filter(room => room.id !== newRoom.id)
				return [newRoom, ...withoutExisting]
			})
		}

		const handleRoomDeleted = (data: { roomId?: string | number }) => {
			const deletedRoomId = Number(data?.roomId)
			if (!Number.isInteger(deletedRoomId) || deletedRoomId <= 0) {
				return
			}

			setRooms(prev => prev.filter(room => room.id !== deletedRoomId))
		}

		const handleDashboardRoomUsersUpdated = (data: {
			roomId?: string | number
			users?: DashboardRoom["users"]
			hostId?: number | null
		}) => {
			const targetRoomId = Number(data?.roomId)
			if (!Number.isInteger(targetRoomId) || targetRoomId <= 0) {
				return
			}

			if (!Array.isArray(data?.users)) {
				return
			}

			const updatedUsers = data.users

			setRooms(prev => prev.map(room => {
				if (room.id !== targetRoomId) {
					return room
				}

				return {
					...room,
					users: updatedUsers,
					...(data.hostId !== undefined && { host_id: data.hostId ?? null })
				}
			}))
		}

		onRoomCreated(handleRoomCreated)
		onRoomDeleted(handleRoomDeleted)
		onDashboardRoomUsersUpdated(handleDashboardRoomUsersUpdated)

		return () => {
			offRoomCreated(handleRoomCreated)
			offRoomDeleted(handleRoomDeleted)
			offDashboardRoomUsersUpdated(handleDashboardRoomUsersUpdated)
		}
	}, [
		activeFilter,
		isConnected,
		onDashboardRoomUsersUpdated,
		onRoomCreated,
		onRoomDeleted,
		offDashboardRoomUsersUpdated,
		offRoomCreated,
		offRoomDeleted
	])

	return (
		<CreateRoomDialogContext.Provider value={{ open, setOpen }}>
			<Box className="dashboard">
				<Stack spacing={3} className="dashboard__content">
					<TSpan className="dashboard__title" content="dashboard.page.title" />

					<Stack direction="row" spacing={1.5} sx={{ flexWrap: "wrap" }}>
						{(["all", "available", "playing"] as DashboardFilter[]).map(filter => (
							<TButton
								key={filter}
								onClick={() => setActiveFilter(filter)}
								variant={filter === activeFilter ? "contained" : "outlined"}
								size="medium"
								className="dashboard__filter-btn"
								sx={{ boxShadow: filter === activeFilter ? 0 : 2 }}
								value={FILTER_KEYS[filter]}
							/>
						)
						)}
					</Stack>

					<Box className="dashboard__scroll-area">
						{errorMessage && <Alert severity="error">{errorMessage}</Alert>}

						{loading ? (
							<Grid container spacing={2}>
								{loadingCards.map(card => <SkeletonRoom key={`loading-card-${card}`} />)}
							</Grid>
						) : null}

						{!loading && !errorMessage ? (
							<Stack spacing={2}>
								<Grid container spacing={2}>
									<CreateRoomCard click={() => setOpen(true)} />
									{rooms.map(room => <RoomCard key={room.id} room={room} />)}
								</Grid>

								{rooms.length === 0 && (
									<Alert severity="info"> {translate("dashboard.feedback.empty")} </Alert>
								)}
							</Stack>
						) : null}
					</Box>
				</Stack>

				<CreateRoomDialog />
			</Box>
		</CreateRoomDialogContext.Provider>
	)
}

export default DashboardPage
