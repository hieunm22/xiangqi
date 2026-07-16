import { useEffect, useState } from "react"
import {
	DialogContent,
	DialogTitle,
	Divider,
	Grid,
	Skeleton,
	Tabs,
} from "@mui/material"
import { PopupState } from "common/enums"
import { openAlert } from "components/AlertProvider/helper"
import { GameReplayPopup } from "components/GameReplay"
import { ResponsiveDialog } from "components/ResponsiveDialog"
import { TButton, TTab } from "components/TranslationTag"
import { HistoryTab, ProfileAchievement, ProfileTab } from "./ProfileTabs"
import {
	getCurrentUserId,
	getToken,
	tabIconClassBuilder,
} from "common/helper"
import { useAPI } from "hooks/useAPI"
import { useProfilePopup } from "hooks/useAppContext"
import useToolkit from "hooks/useToolkit"
import { setPopup, setRoomHostId, setUserId } from "toolkit/slice/game"
import { APIResponse } from "types/Common"
import {
	Achievement,
	GameHistoryItem,
	UserProfileWithStats
} from "../types"

export const ProfilePopup = () => {
	const { gameState, dispatch } = useToolkit()
	const {
		getAchievements,
		getPlayerHistory,
		getUserById,
		kickUser,
	} = useAPI()
	const [activeTab, setActiveTab] = useState(0)
	const [achievements, setAchievements] = useState<Achievement[] | null>(null)
	const [gameHistories, setGameHistories] = useState<GameHistoryItem[] | null>(null)
	const [replayGame, setReplayGame] = useState<GameHistoryItem | null>(null)
	const {
		profileUser: user,
		setGameStats,
		setProfileUser
	} = useProfilePopup()

	const handleCloseProfilePopup = (_: unknown, reason: "backdropClick" | "escapeKeyDown") => {
		if (reason === "backdropClick") return
		dispatch(setUserId(null))
		dispatch(setRoomHostId(null))
		setProfileUser(null)
		setGameStats(null)
		setActiveTab(0)
		setAchievements(null)
		setGameHistories(null)
		setReplayGame(null)
		dispatch(setPopup(PopupState.NONE))
	}

	const currentUserId = getCurrentUserId()
	const isOwnProfile = user?.id === currentUserId

	const loadRoomContext = async () => {
		// PROFILE bit must be set and the chat (SEND_PM) must not be on top —
		// otherwise the profile is only stacked behind an open chat.
		if ((gameState.popupState & PopupState.PROFILE) !== PopupState.PROFILE
			|| (gameState.popupState & PopupState.SEND_PM) === PopupState.SEND_PM) {
			return
		}

		const token = getToken()
		if (!token) {
			return
		}

		type ProfileTabResponse = APIResponse<UserProfileWithStats>
		const response = await getUserById(token, gameState.activeUserId!) as ProfileTabResponse
		if (response) {
			setProfileUser(response.data.user)
			setGameStats(response.data.stats)
		}
	}

	// Achievements are fetched lazily the first time the tab is opened, then
	// cached in state so re-opening the tab (while the popup stays open) reuses it.
	const loadAchievements = async () => {
		if (achievements !== null) {
			return
		}

		const token = getToken()
		if (!token) {
			return
		}

		type ListAchievements = APIResponse<Achievement[]>
		const response = await getAchievements(token, gameState.activeUserId!) as ListAchievements
		if (response?.success) {
			setAchievements(response.data)
		}
	}

	// Game history is likewise fetched lazily on first open of the tab and cached.
	const loadHistory = async () => {
		if (gameHistories !== null) {
			return
		}

		const token = getToken()
		if (!token) {
			return
		}

		type ListGameHistory = APIResponse<GameHistoryItem[]>
		const response = await getPlayerHistory(token, gameState.activeUserId!) as ListGameHistory
		if (response?.success && response.data) {
			setGameHistories(response.data)
		}
	}

	const handleTabChange = (value: number) => {
		setActiveTab(value)
		if (value === 1) {
			loadAchievements()
		} else if (value === 2) {
			loadHistory()
		}
	}

	useEffect(() => {
		loadRoomContext()
	}, [gameState.popupState, gameState.roomHostId])

	// Reset to the profile tab and clear cached tab data whenever the viewed user changes
	useEffect(() => {
		setActiveTab(0)
		setAchievements(null)
		setGameHistories(null)
		setReplayGame(null)
	}, [gameState.activeUserId])


	const handleSendPM = () => {
		dispatch(setUserId(gameState.activeUserId))
		dispatch(setPopup(PopupState.PROFILE | PopupState.SEND_PM))
	}

	const handleKickUser = async () => {
		if (!user) {
			return
		}

		const roomIdMatch = location.pathname.match(/^\/room\/(\d+)$/)
		if (!roomIdMatch) {
			return
		}

		const roomId = Number(roomIdMatch[1])
		const token = getToken()
		if (!token || !Number.isInteger(roomId) || roomId <= 0) {
			return
		}

		const response = await kickUser(token, roomId, user.id)
		if (!response || !response.success) {
			await openAlert({
				title: "popup.alert.title",
				message: response?.message ?? "kick-user.messages.internal-server-error"
			})
			return
		}

		// The kicked user is removed from everyone's seat list via the
		// `room-users-updated` socket broadcast, so the host just closes the popup.
		dispatch(setPopup(PopupState.NONE))
	}

	const profileOpen = (gameState.popupState & PopupState.PROFILE) === PopupState.PROFILE
		&& (gameState.popupState & PopupState.SEND_PM) !== PopupState.SEND_PM

	return (
		<ResponsiveDialog
			drawerAnchor="top"
			open={profileOpen}
			onClose={handleCloseProfilePopup}
			className="profile-dialog"
			fullWidth
			disableEnforceFocus
			disableAutoFocus
			autoFocus={false}
		>
			<DialogTitle className="pt-8 pb-8">
				{
					user ? user.display_name : <Skeleton variant="text" width={120} height={32} />
				}
			</DialogTitle>
			<Divider sx={{ borderColor: "primary.main" }} />
			<DialogContent>
				<Tabs
					className="profile-tabs"
					value={activeTab}
					onChange={(_, value) => handleTabChange(value)}
					variant="fullWidth"
					textColor="primary"
					indicatorColor="primary"
				>
					<TTab
						className="profile-tab"
						icon={<i className={tabIconClassBuilder(0, activeTab, "user")} />}
						iconPosition="start"
						label="menu.profile"
					/>
					<TTab
						className="profile-tab"
						icon={<i className={tabIconClassBuilder(1, activeTab, "trophy")} />}
						iconPosition="start"
						label="achievement.tab-title"
					/>
					<TTab
						className="profile-tab"
						icon={<i className={tabIconClassBuilder(2, activeTab, "clock")} />}
						iconPosition="start"
						label="room.actions.view-history"
					/>
				</Tabs>
				<Divider className="mb-20" sx={{ borderColor: "primary.main" }} />

				{activeTab === 0 && (
					<ProfileTab user={user} />
				)}

				{activeTab === 1 && (
					<ProfileAchievement achievements={achievements} />
				)}

				{activeTab === 2 && (
					<HistoryTab gameHistories={gameHistories} onOpenReplay={setReplayGame} />
				)}

			</DialogContent>
			<Divider sx={{ borderColor: "primary.main" }} />
			<Grid container className="profile-dialog-actions">
				{!(user?.id === gameState.activeUserId) ? (
					<>
						<Skeleton variant="rounded" width="calc(40% - 8px)" height={31} />
						<Skeleton variant="rounded" width="calc(40% - 8px)" height={31} />
					</>
				) : (
					<>
						{!isOwnProfile && (
							<TButton
								variant="contained"
								size="small"
								color="info"
								onClick={handleSendPM}
								value="room.actions.send-pm"
								startIcon={<i className="fas fa-comment" />}
							/>
						)}
						{user && !isOwnProfile && gameState.roomHostId === currentUserId && (
							<TButton
								variant="contained"
								size="small"
								color="error"
								disabled={gameState.roomHostId !== currentUserId || gameState.isInGame}
								onClick={handleKickUser}
								value="room.actions.kick"
								startIcon={<i className="fas fa-ban" />}
							/>
						)}
					</>
				)}
				<TButton
					variant="outlined"
					size="small"
					onClick={e => handleCloseProfilePopup(e, "escapeKeyDown")}
					value="settings.close"
					startIcon={<i className="fas fa-xmark" />}
				/>
			</Grid>
			<GameReplayPopup game={replayGame} onClose={() => setReplayGame(null)} />
		</ResponsiveDialog>
	)
}
