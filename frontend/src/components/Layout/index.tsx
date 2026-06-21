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
import {
	HOME_PATH,
	LOGIN_PATH,
	LS_DARKMODE,
	LS_TOKEN_KEY
} from "common/constant"
import { PopupState } from "common/enums"
import { PrivateChatPopup } from "./components/PrivateChatPopup"
import { GameHistoryPopup } from "./components/GameHistoryPopup"
import { TI, TTypography } from "components/TranslationTag"
import { PopupProvider, useAuth } from "hooks/useAppContext"
import { GuidePopup } from "./components/GuidePopup"
import { ProfilePopup } from "./components/ProfilePopup"
import { SettingsPopup } from "./components/SettingsPopup"
import { SearchUserPopup } from "./components/SearchUserPopup"
import {
	decodePayload,
	getToken,
	requireImage
} from "common/helper"
import { useAPI } from "hooks/useAPI"
import { useSocket } from "hooks/useSocket"
import useAutoTitle from "hooks/useAutoTitle"
import useToolkit from "hooks/useToolkit"
import { setPopup } from "toolkit/slice/game"
import { setDarkMode } from "toolkit/slice/home"
import { translate } from "locales/translate"
import { APIResponse } from "types/Common"
import { Users } from "types/Entities"
import useLayoutAuth from "pages/Dashboard/hook"
import { GameStats, UserProfileWithStats } from "./types"
import "./Layout.scss"

const fullWidth = 240
const miniWidth = 60

export default function Layout() {
	const [drawerOpen, setDrawerOpen] = useState(true)
	const [mobileOpen, setMobileOpen] = useState(false)
	const [userMenuAnchor, setUserMenuAnchor] = useState<null | HTMLElement>(null)
	const [currentUserId, setCurrentUserId] = useState<number | null>(null)
	const [profileUser, setProfileUser] = useState<Users | null>(null)
	const [gameStats, setGameStats] = useState<GameStats | null>(null)
	const [userDisplayName, setUserDisplayName] = useState("")
	const [userImage, setUserImage] = useState("")
	const [unreadCount, setUnreadCount] = useState(0)
	const [announcementCount, setAnnouncementCount] = useState(0)
	const navigate = useNavigate()
	const {
		getUnreadCount,
		getUserById,
		leaveRoom,
		logout,
		makeExpired,
		resetGame
	} = useAPI()
	const { gameState, state, dispatch } = useToolkit()
	const { offAnnouncementSent, onAnnouncementSent } = useSocket()
	const { showProfilePopup } = useLayoutAuth()
	const theme = useTheme()
	const isMobile = useMediaQuery(theme.breakpoints.down("sm"))
	useAutoTitle()

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
				console.error("Failed to get unread count:", error)
			}
		}

		getLoginUserInfo()
		getPrivateMessagesUnread()
	}, [])

	// Live-update the announcement badge when another client sends one. Ignore
	// our own announcement, and don't bump the badge while the user is actively
	// viewing the announcement screen (it marks everything read on open).
	useEffect(() => {
		const handleAnnouncement = (data: any) => {
			if (data?.userId === currentUserId) return
			if (window.location.pathname === "/announce") return
			setAnnouncementCount(prev => prev + 1)
		}

		onAnnouncementSent(handleAnnouncement)
		return () => offAnnouncementSent(handleAnnouncement)
	}, [onAnnouncementSent, offAnnouncementSent, currentUserId])

	const { setLogout } = useAuth()

	const logoutClick = async () => {
		const token = getToken()

		try {
			if (token) {
				await logout(token)
			}
		} catch (error) {
			console.error("Logout failed:", error)
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
		handleCloseUserMenu()
		const activeElement = document.activeElement as HTMLElement | null
		activeElement?.blur()

		showProfilePopup(currentUserId)
	}

	const handleGoMessages = () => {
		handleCloseUserMenu()
		const activeElement = document.activeElement as HTMLElement | null
		activeElement?.blur()

		// Open the private message popup without a preselected conversation;
		// the user picks one from the drawer.
		dispatch(setPopup(PopupState.SEND_PM))
	}

	const handleMakeExpired = async () => {
		const token = getToken()
		if (!token) return
		handleCloseUserMenu()
		const expiredToken = await makeExpired(token)
		if (typeof expiredToken === "string" && expiredToken) {
			localStorage.setItem(LS_TOKEN_KEY, expiredToken)
		}
	}

	const handleLogoutFromMenu = async () => {
		handleCloseUserMenu()
		dispatch(setPopup(PopupState.NONE))
		await logoutClick()
	}

	const handleGoHome = async () => {
		if (location.pathname.startsWith("/room/")) {
			const token = getToken()
			const id = Number(location.pathname.substring("/room/".length))
			if (Number.isInteger(id) && id > 0) {
				await leaveRoom(token, id)
			}
		}
		navigate(HOME_PATH)
	}

	const isInRoom = location.pathname.startsWith("/room/")

	const menuItems = [
		{ text: "menu.home", icon: "fa-home", click: handleGoHome },
		{ text: "menu.guide", icon: "fa-book", click: handleShowGuide },
		{ text: "menu.announce", icon: "fa-bullhorn", click: handleShowAnnounce, badge: announcementCount },
		{ text: "menu.setting.button", icon: "fa-gear", click: handleShowSettings },
		// ...(isInRoom ? [{ text: "Restart", icon: "fa-rotate", click: handleRestart }] : []),
	]

	const toogleDrawerClass = classnames("fas", {
		"fa-chevrons-right": !drawerOpen,
		"fa-chevrons-left": drawerOpen,
		"icon-toogle-drawer": true
	})

	const profileProviderValue = {
		gameStats,
		profileUser,
		unreadCount,

		setGameStats,
		setProfileUser,
		setUnreadCount
	}

	const DrawerContent = () => (
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
					<ListItemButton key={item.text} className="menu-item" onClick={item.click}>
						<Badge badgeContent={item.badge} color="error" max={9} invisible={!item.badge}>
							<TI className={`fas ${item.icon} icon`} title={item.text} />
						</Badge>
						{drawerOpen && <TTypography content={item.text} className="text" />}
					</ListItemButton>
				))}
			</List>

			<Divider sx={{ mt: "auto" }} />

			<List>
				{isInRoom && state.debugMode && <ListItem className="menu-item" onClick={handleRestart}>
						<TI className="fas fa-rotate icon" title="Restart" />
						{drawerOpen && <TTypography className="text" content="Restart" />}
					</ListItem>
				}
				<ListItem disablePadding className="menu-item">
					<ListItemButton onClick={logoutClick}>
						<TI className="fas fa-left-from-bracket icon" title="menu.logout" />
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
					<Avatar src={userImage} alt={displayName} className="user-avatar-small" />
					{displayName}
				</Button>
			</Box>

			{isMobile && <AppBar position="fixed" className="layout-mobile-appbar">
				<Toolbar>
					<IconButton color="inherit" edge="start" onClick={handleMobileToggle} className="layout-mobile-menu-btn">
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
				anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
				transformOrigin={{ vertical: "top", horizontal: "right" }}
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
					{translate("menu.profile")}
				</MenuItem>
				<MenuItem
					onClick={handleGoMessages}
					className="menu-item-gap"
					disabled={gameState.popupState === PopupState.SEND_PM}
				>
					<i className="far fa-comment fsx-14" />
					<Box className="menu-message">
						{translate("menu.messages")}
						{unreadCount > 0 && (
							<Box className="menu-unread-count">
								{unreadCount > 99 ? "99+" : unreadCount}
							</Box>
						)}
					</Box>
				</MenuItem>
				{state.debugMode && <Divider className="menu-divider" />}
				{state.debugMode && (
					<MenuItem onClick={handleMakeExpired} className="menu-item-gap">
						<i className="fas fa-clock fsx-14" />
						{translate("menu.expired")}
					</MenuItem>
				)}
				<Divider className="menu-divider" />
				<MenuItem onClick={handleLogoutFromMenu} className="menu-logout">
					<i className="fas fa-left-from-bracket" />
					{translate("menu.logout")}
				</MenuItem>
			</Menu>

			{/* Navigation */}
			<Box
				component="nav"
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
						"& .MuiDrawer-paper": { boxSizing: "border-box", width: drawerOpen ? fullWidth : miniWidth },
					}}
				>
					<DrawerContent />
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
					<DrawerContent />
				</Drawer>
			</Box>

			{/* popups */}
			<PopupProvider value={profileProviderValue}>
				<Box
					component="main"
					sx={{
						flexGrow: 1,
						width: {
							xs: `100%`,
							sm: `calc(100% - ${fullWidth}px)`,
							md: `calc(100% - ${fullWidth}px)`,
							lg: `calc(100% - ${fullWidth}px)`,
						},
						p: 1,
					}}
				>
					{isMobile && <Toolbar />}
					<Outlet />

					<SettingsPopup />
					<ProfilePopup />
					<GuidePopup />
					<GameHistoryPopup />
					<PrivateChatPopup />
					<SearchUserPopup />
				</Box>
			</PopupProvider>
		</Box>
	)
}
