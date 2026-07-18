import { useEffect, useState } from "react"
import { Outlet, useNavigate } from "react-router-dom"
import classnames from "classnames"
import {
	AppBar,
	Avatar,
	Badge,
	Box,
	Button,
	CssBaseline,
	Divider,
	Drawer,
	IconButton,
	List,
	ListItem,
	ListItemButton,
	Menu,
	MenuItem,
	Toolbar,
	useMediaQuery,
	useTheme
} from "@mui/material"
import landscapeBg from "assets/landscape.PNG?url"
import portraitBg from "assets/portrait.jpg?url"
import {
	HOME_PATH,
	LOGIN_PATH,
	LS_DARKMODE,
	LS_TOKEN_KEY,
	LUCKY_WHEEL_SLOT_HOURS
} from "common/constant"
import { PopupState } from "common/enums"
import { TI, TSpan, TTypography } from "components/TranslationTag"
import { ChangePasswordDialog } from "./components/ChangePasswordDialog"
import { PrivateChatPopup } from "./components/PrivateChatPopup"
import { GuidePopup } from "./components/GuidePopup"
import { ProfilePopup } from "./components/ProfilePopup"
import { SearchUserPopup } from "./components/SearchUserPopup"
import { SettingsPopup } from "./components/SettingsPopup"
import { JoinRoomDialog } from "pages/Dashboard/components/JoinRoomDialog"
import { openJoinRoom } from "pages/Dashboard/components/joinRoomController"
import {
	decodePayload,
	getTimeToNextSlot,
	getToken,
	logger,
	requireImage
} from "common/helper"
import { OnlinePresenceProvider } from "hooks/OnlinePresenceProvider"
import { ProfilePopupProvider, useAuth } from "hooks/useAppContext"
import { useAPI } from "hooks/useAPI"
import { useSocket } from "hooks/useSocket"
import useAutoTitle from "hooks/useAutoTitle"
import { usePresenceHeartbeat } from "hooks/usePresenceHeartbeat"
import useToolkit from "hooks/useToolkit"
import useLayoutAuth from "pages/Dashboard/hook"
import { setPopup } from "toolkit/slice/game"
import { setDarkMode } from "toolkit/slice/home"
import { APIResponse } from "types/Common"
import { Users } from "types/Entities"
import { RoomInfoData } from "pages/Room/types"
import { GameStats, UserProfileWithStats } from "./types"
import "./Layout.scss"

const fullWidth = 240
const miniWidth = 90

export default function Layout() {
	useAutoTitle()
	const [drawerOpen, setDrawerOpen] = useState(true)
	const [mobileOpen, setMobileOpen] = useState(false)
	const [userMenuAnchor, setUserMenuAnchor] = useState<null | HTMLElement>(null)
	const [currentUserId, setCurrentUserId] = useState<number | null>(null)
	const [currentUser, setCurrentUser] = useState<Users | null>(null)
	const [profileUser, setProfileUser] = useState<Users | null>(null)
	const [gameStats, setGameStats] = useState<GameStats | null>(null)
	const [userDisplayName, setUserDisplayName] = useState("")
	const [userImage, setUserImage] = useState("")
	const [unreadCount, setUnreadCount] = useState(0)
	const [announcementCount, setAnnouncementCount] = useState(0)
	const [luckyPending, setLuckyPending] = useState(false)
	const navigate = useNavigate()
	const {
		getLuckySpins,
		getRoomById,
		getUnreadCount,
		getUserById,
		logout,
		makeExpired,
		resetGame
	} = useAPI()
	const { gameState, state, dispatch } = useToolkit()
	const {
		offAnnouncementSent,
		onAnnouncementSent,
		offRoomInvite,
		onRoomInvite,
		registerUser
	} = useSocket()
	const { showProfilePopup } = useLayoutAuth()

	// Keep the current user's presence fresh while they have a visible tab.
	usePresenceHeartbeat(currentUserId)
	const theme = useTheme()
	const isMobile = useMediaQuery(theme.breakpoints.down("sm"))

	const setDarkModeAction = (darkMode: boolean) => dispatch(setDarkMode(darkMode))
	const handleMobileToggle = () => setMobileOpen(!mobileOpen)

	const handleMobileDrawerClose = () => {
		(document.activeElement as HTMLElement)?.blur()
		setMobileOpen(false)
	}

	const handleDrawerToggle = () => setDrawerOpen(!drawerOpen)

	useEffect(() => {
		const isDarkMode = localStorage.getItem(LS_DARKMODE) === "dark"
		setDarkModeAction(isDarkMode)
	}, [])

	useEffect(() => {
		document.documentElement.style.setProperty("--layout-bg-image", `url(${landscapeBg})`)
		document.documentElement.style.setProperty("--layout-bg-image-mobile", `url(${portraitBg})`)

		return () => {
			document.documentElement.style.removeProperty("--layout-bg-image")
			document.documentElement.style.removeProperty("--layout-bg-image-mobile")
		}
	}, [])

	useEffect(() => {
		const getLoginUserInfo = async () => {
			const token = getToken()
			const claims = decodePayload(token)
			const userId = Number(claims?.sub)
			if (!Number.isInteger(userId) || userId <= 0) return
			setCurrentUserId(userId)

			const user = await getUserById(token, userId) as APIResponse<UserProfileWithStats>
			if (!user?.data) return
			const { avatar_url, display_name } = user.data.user
			const avatar = requireImage(avatar_url)

			setUserImage(avatar)
			setUserDisplayName(display_name)
			setCurrentUser(user.data.user)
			setProfileUser(user.data.user)
		}

		const getPrivateMessagesUnread = async () => {
			const token = getToken()
			if (!token) return

			try {
				const response = await getUnreadCount(token)
				if (response?.success && response.data) {
					setUnreadCount(response.data.total_pm)
					setAnnouncementCount(response.data.announcements)
				}
			} catch (error) {
				logger.error("Failed to get unread count:", error)
			}
		}

		getLoginUserInfo()
		getPrivateMessagesUnread()
	}, [])

	// Show a badge on the wheel menu when a slot bonus (+3 spins per 6h boundary) is pending.
	// Re-check at the next boundary so the badge appears even if the app stays open.
	useEffect(() => {
		let timer: ReturnType<typeof setTimeout>

		const fetchLuckyStatus = async () => {
			const token = getToken()
			if (!token) return

			try {
				const response = await getLuckySpins(token)
				if (response?.success && response.data) {
					setLuckyPending(Boolean(response.data.pending))
				}
			} catch (error) {
				logger.error("Failed to get lucky spins status:", error)
			}

			timer = setTimeout(fetchLuckyStatus, getTimeToNextSlot(LUCKY_WHEEL_SLOT_HOURS))
		}

		fetchLuckyStatus()
		return () => clearTimeout(timer)
	}, [])

	// Live-update the announcement badge on new announcements from other clients.
	// Ignore own announcements and skip the bump when the user is viewing the announcement screen.
	useEffect(() => {
		const handleAnnouncement = (data: any) => {
			if (data?.userId === currentUserId) return
			if (window.location.pathname === "/announce") return
			setAnnouncementCount(prev => prev + 1)
		}

		onAnnouncementSent(handleAnnouncement)
		return () => offAnnouncementSent(handleAnnouncement)
	}, [onAnnouncementSent, offAnnouncementSent, currentUserId])

	// Register the current user's socket so they can receive targeted events
	// (private messages, room invites) on any page.
	useEffect(() => {
		if (!currentUserId) return
		registerUser(currentUserId)
	}, [currentUserId, registerUser])

	// Show JoinRoomDialog when another user sends a room invitation.
	useEffect(() => {
		const handleRoomInvite = async (data: { roomId: number; inviterDisplayName: string }) => {
			const token = getToken()
			if (!token) return
			const response = await getRoomById(token, data.roomId) as APIResponse<RoomInfoData>
			if (!response?.success || !response.data) return
			const { room, users } = response.data
			openJoinRoom({
				...room,
				users,
				created_at: "",
				updated_at: "",
				time_limit: null,
				time_increment: null,
				time_per_move: null
			})
		}

		onRoomInvite(handleRoomInvite)
		return () => offRoomInvite(handleRoomInvite)
	}, [onRoomInvite, offRoomInvite])

	const { setLogout } = useAuth()

	const logoutClick = async () => {
		const token = getToken()

		try {
			if (token) {
				await logout(token)
			}
		} finally {
			localStorage.removeItem(LS_TOKEN_KEY)
			setLogout()
			navigate(LOGIN_PATH)
		}
	}

	const handleShowSettings = () => {
		(document.activeElement as HTMLElement)?.blur()
		dispatch(setPopup(PopupState.SETTINGS))
		setMobileOpen(false)
	}

	const handleShowGuide = () => {
		(document.activeElement as HTMLElement)?.blur()
		dispatch(setPopup(PopupState.GUIDE))
		setMobileOpen(false)
	}

	const handleShowAnnounce = () => {
		navigate("/announce")
		setMobileOpen(false)
		// Opening the screen marks announcements read, so clear the badge now.
		setAnnouncementCount(0)
	}

	const handleWheelClick = () => {
		(document.activeElement as HTMLElement)?.blur()
		navigate("/extra-money")
		setMobileOpen(false)
		// The wheel page claims the pending spins on open, so clear the badge now.
		setLuckyPending(false)
	}

	const handleLeaderboardClick = () => {
		(document.activeElement as HTMLElement)?.blur()
		navigate("/leaderboard")
		setMobileOpen(false)
	}

	const handleRestart = async () => {
		const token = getToken()
		if (!token) return
		const path = location.pathname
		const roomId = Number(path.substring("/room/".length))
		if (!Number.isInteger(roomId) || roomId <= 0) return
		await resetGame(token, roomId)
	}

	const displayName = userDisplayName
	const userMenuOpen = Boolean(userMenuAnchor)

	const handleOpenUserMenu = (e: React.MouseEvent<HTMLElement>) => {
		setUserMenuAnchor(e.currentTarget)
	}

	const handleCloseUserMenu = () => {
		setUserMenuAnchor(null)
	}

	const handleGoProfile = () => {
		if (!currentUserId) return
		const activeElement = document.activeElement as HTMLElement | null
		activeElement?.blur()

		showProfilePopup(currentUserId)
	}

	const handleChangePassword = () => {
		const activeElement = document.activeElement as HTMLElement | null
		activeElement?.blur()

		dispatch(setPopup(PopupState.CHANGE_PASSWORD))
	}

	const handleGoMessages = () => {
		const activeElement = document.activeElement as HTMLElement | null
		activeElement?.blur()

		dispatch(setPopup(PopupState.SEND_PM))
	}

	const handleMakeExpired = async () => {
		const token = getToken()
		if (!token) return
		const expiredToken = await makeExpired(token)
		if (typeof expiredToken === "string" && expiredToken) {
			localStorage.setItem(LS_TOKEN_KEY, expiredToken)
		}
	}

	const handleLogoutFromMenu = async () => {
		dispatch(setPopup(PopupState.NONE))
		await logoutClick()
	}

	const handleGoHome = async () => {
		navigate(HOME_PATH)
	}

	const isInRoom = location.pathname.startsWith("/room/")

	const menuInDrawer = [
		PopupState.SETTINGS,
		PopupState.GUIDE
	]
	const menuItems = [
		{
			text: "menu.home",
			icon: "fa-home",
			click: handleGoHome,
			active: window.location.pathname === HOME_PATH
				&& !menuInDrawer.includes(gameState.popupState)
		},
		{
			text: "menu.guide",
			icon: "fa-book",
			click: handleShowGuide,
			active: gameState.popupState === PopupState.GUIDE
		},
		{
			text: "menu.announce",
			icon: "fa-bullhorn",
			click: handleShowAnnounce,
			active: window.location.pathname === "/announce"
				&& !menuInDrawer.includes(gameState.popupState),
			badge: announcementCount
		},
		{
			text: "menu.extra",
			icon: "fa-sack-dollar",
			click: handleWheelClick,
			active: window.location.pathname === "/extra-money"
				&& !menuInDrawer.includes(gameState.popupState),
			dot: luckyPending
		},
		{
			text: "menu.leaderboard",
			icon: "fa-ranking-star",
			click: handleLeaderboardClick,
			active: window.location.pathname === "/leaderboard"
				&& !menuInDrawer.includes(gameState.popupState),
		},
		{
			text: "menu.setting.button",
			icon: "fa-gear",
			click: handleShowSettings,
			active: gameState.popupState === PopupState.SETTINGS
		},
	]

	const toogleDrawerClass = classnames("fas", {
		"fa-chevrons-right": !drawerOpen,
		"fa-chevrons-left": drawerOpen,
		"icon-toogle-drawer": true
	})

	const profileProviderValue = {
		currentUser,
		gameStats,
		profileUser,
		unreadCount,

		setGameStats,
		setProfileUser,
		setUnreadCount
	}

	const drawerContent = (
		<>
			<Toolbar>
				<TTypography
					variant="h6"
					noWrap
					component="div"
					className="bold"
					content="menu.app-name"
				/>
			</Toolbar>

			<List>
				{menuItems.map(item => (
					<ListItemButton
						selected={item.active}
						key={item.text}
						className="menu-item"
						onClick={item.click}
					>
						<Badge
							badgeContent={item.badge}
							variant={item.dot ? "dot" : "standard"}
							color="error"
							max={9}
							invisible={item.dot ? false : !item.badge}
						>
							<TI className={`fad ${item.icon} icon`} title={item.text} />
						</Badge>
						{drawerOpen && <TTypography content={item.text} className="text" />}
					</ListItemButton>
				))}
			</List>

			<Divider sx={{ mt: "auto" }} />

			<List>
				{isInRoom && state.debugMode && <ListItem disablePadding className="menu-item">
					<ListItemButton onClick={handleRestart}>
						<TI className="fas fa-rotate icon" title="Restart" />
						{drawerOpen && <TTypography className="text" content="Restart" />}
					</ListItemButton>
				</ListItem>
				}
				<ListItem disablePadding className="menu-item">
					<ListItemButton onClick={logoutClick}>
						<TI className="fad fa-left-from-bracket icon" title="menu.logout" />
						{drawerOpen && <TTypography className="text" content="menu.logout" />}
					</ListItemButton>
					<TI className={toogleDrawerClass} onClick={handleDrawerToggle} />
				</ListItem>
			</List>
		</>
	)

	return (
		<Box className="layout-root">
			<CssBaseline />

			<Box
				sx={{
					position: "fixed",
					top: 12,
					right: 12,
					zIndex: theme.zIndex.appBar + 2,
					display: { xs: "none", sm: "block" }
				}}
			>
				<Button
					onClick={handleOpenUserMenu}
					variant="outlined"
					size="small"
					className="layout-user-btn"
					sx={{ backgroundColor: "background.paper" }}
				>
					<Badge
						badgeContent={unreadCount}
						color="error"
						max={9}
						invisible={unreadCount === 0}
					>
						<Avatar src={userImage} alt={displayName} className="user-avatar-small" />
					</Badge>
					{displayName}
				</Button>
			</Box>

			{isMobile && <AppBar position="fixed" className="layout-mobile-appbar">
				<Toolbar>
					<IconButton
						color="inherit"
						edge="start"
						onClick={handleMobileToggle}
						className="layout-mobile-menu-btn"
					>
						<i className="fas fa-bars" />
					</IconButton>
					<Box sx={{ flexGrow: 1 }} />
					<Button
						onClick={handleOpenUserMenu}
						variant="outlined"
						size="small"
						className="layout-mobile-user-btn"
					>
						<Avatar src={userImage} alt={displayName} className="user-avatar-small" />
						{displayName}
					</Button>
				</Toolbar>
			</AppBar>}

			{/* User menu */}
			<Menu
				anchorEl={userMenuAnchor}
				open={userMenuOpen}
				onClose={handleCloseUserMenu}
				onClick={handleCloseUserMenu}
				anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
				transformOrigin={{ vertical: "top", horizontal: "right" }}
				disableRestoreFocus
				slotProps={{
					paper: {
						sx: {
							minWidth: userMenuAnchor?.offsetWidth,
							width: "max-content",
							mt: "3px"
						}
					},
					list: { dense: true, sx: { left: 1, py: 0.5 } }
				}}
			>
				<MenuItem onClick={handleGoProfile} className="menu-item-gap">
					<i className="fas fa-user fsx-14" />
					<TSpan className="menu-text" content="menu.profile" />
				</MenuItem>
				<MenuItem
					onClick={handleGoMessages}
					className="menu-item-gap"
					disabled={(gameState.popupState & PopupState.SEND_PM) === PopupState.SEND_PM}
				>
					<Badge
						badgeContent={unreadCount}
						color="error"
						max={9}
						invisible={unreadCount === 0}
					>
						<i className="far fa-comment fsx-14" />
					</Badge>
					<Box className="menu-message">
						<TSpan className="menu-text" content="menu.messages" />
					</Box>
				</MenuItem>
				{!gameState.isInGame && (<Divider className="menu-divider" />)}
				{!gameState.isInGame && (
					<MenuItem onClick={handleChangePassword} className="menu-item-gap">
						<i className="fas fa-key fsx-14" />
						<TSpan className="menu-text" content="menu.change-password" />
					</MenuItem>
				)}
				{state.debugMode && <Divider className="menu-divider" />}
				{state.debugMode && (
					<MenuItem onClick={handleMakeExpired} className="menu-item-gap">
						<i className="fas fa-clock fsx-14" />
						<TSpan className="menu-text" content="menu.expired" />
					</MenuItem>
				)}
				<Divider className="menu-divider" />
				<MenuItem onClick={handleLogoutFromMenu} className="menu-logout">
					<i className="fas fa-left-from-bracket" />
					<TSpan className="menu-text" content="menu.logout" />
				</MenuItem>
			</Menu>

			{/* Navigation */}
			<Box
				component="div"
				sx={{
					width: { sm: drawerOpen ? fullWidth : miniWidth },
					flexShrink: { sm: 0 }
				}}
			>
				<Drawer
					variant="temporary"
					open={mobileOpen}
					onClose={handleMobileDrawerClose}
					sx={{
						display: { xs: "block", sm: "none" },
						"& .MuiDrawer-paper": {
							boxSizing: "border-box",
							width: drawerOpen ? fullWidth : miniWidth,
						}
					}}
				>
					{drawerContent}
				</Drawer>

				{/* Desktop drawer - permanent */}
				<Drawer
					variant="permanent"
					open={drawerOpen}
					sx={{
						display: { xs: "none", sm: "block" },
						"& .MuiDrawer-paper": {
							width: drawerOpen ? fullWidth : miniWidth,
							overflowX: "hidden",
							transition: theme.transitions.create("width", {
								easing: theme.transitions.easing.sharp,
								duration: theme.transitions.duration.enteringScreen,
							}),
							boxSizing: "border-box",
						},
					}}
				>
					{drawerContent}
				</Drawer>
			</Box>

			{/* popups */}
			<ProfilePopupProvider value={profileProviderValue}>
				<OnlinePresenceProvider>
					<Box component="div" className="layout-page-shell layout-bg-shell">
						{isMobile && <Toolbar />}
						<Outlet />

						<SettingsPopup />
						<ProfilePopup />
						<ChangePasswordDialog />
						<GuidePopup />
						<PrivateChatPopup />
						<SearchUserPopup />
						<JoinRoomDialog />
					</Box>
				</OnlinePresenceProvider>
			</ProfilePopupProvider>
		</Box>
	)
}
