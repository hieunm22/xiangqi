import { useEffect, useState } from "react"
import { Outlet, useNavigate } from "react-router-dom"
import classnames from "classnames"
import {
	AppBar,
	Avatar,
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
import { PopupState } from "./enums"
import { GameHistoryPopup } from "./components/GameHistoryPopup"
import { TI, TSpan, TTypography } from "components/TranslationTag"
import { PopupProvider, useAuth } from "hooks/useAppContext"
import { GuidePopup } from "./components/GuidePopup"
import { ProfilePopup } from "./components/ProfilePopup"
import { SettingsPopup } from "./components/SettingsPopup"
import {
	decodePayload,
	getToken,
	requireImage
} from "common/helper"
import { useAPI } from "hooks/useAPI"
import useAutoTitle from "hooks/useAutoTitle"
import useToolkit from "hooks/useToolkit"
import { setDarkMode, setPopup } from "toolkit/slice/home"
import { translate } from "locales/translate"
import { Users } from "types/Entities"
import "./Layout.scss"

const fullWidth = 240
const miniWidth = 60

export default function Layout() {
	const [drawerOpen, setDrawerOpen] = useState(true)
	const [mobileOpen, setMobileOpen] = useState(false)
	const [userMenuAnchor, setUserMenuAnchor] = useState<null | HTMLElement>(null)
	const [showDebugMenu, setShowDebugMenu] = useState(false)
	const [currentUserId, setCurrentUserId] = useState<number | null>(null)
	const [profileUser, setProfileUser] = useState<Users | null>(null)
	const [userDisplayName, setUserDisplayName] = useState("")
	const [userImage, setUserImage] = useState("")
	const navigate = useNavigate()
	const {
		getUserById,
		leaveRoom,
		logout,
		makeExpired,
		resetGame
	} = useAPI()
	const { dispatch } = useToolkit()
	const theme = useTheme()
	const isMobile = useMediaQuery(theme.breakpoints.down("sm"))
	useAutoTitle()

	const setDarkModeAction = (darkMode: boolean) => dispatch(setDarkMode(darkMode))
	const handleMobileToggle = () => setMobileOpen(!mobileOpen)
	const handleDrawerToggle = () => setDrawerOpen(!drawerOpen)

	useEffect(() => {
		const isDarkMode = localStorage.getItem(LS_DARKMODE) === "dark"
		setDarkModeAction(isDarkMode)
	}, [])

	useEffect(() => {
		const getUserInfo = async () => {
			const token = getToken()
			const claims = decodePayload(token)
			const userId = Number(claims?.sub)
			if (!Number.isInteger(userId) || userId <= 0) return
			setCurrentUserId(userId)

			const user = await getUserById(userId)
			if (!user?.data) return
			const { avatar_url, display_name } = user.data
			const avatar = requireImage(avatar_url)

			setUserImage(avatar)
			setUserDisplayName(display_name)
		}

		getUserInfo()
	}, [])

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

	const loadProfileUser = async (userId: number) => {
		setProfileUser(null)

		const user = await getUserById(userId)
		if (user?.data) {
			setProfileUser(user.data)
		}
	}

	const handleOpenUserMenu = (e: React.MouseEvent<HTMLElement>) => {
		setShowDebugMenu(e.shiftKey)
		setUserMenuAnchor(e.currentTarget)
	}

	const handleCloseUserMenu = () => {
		setUserMenuAnchor(null)
	}

	const handleGoProfile = async () => {
		if (!currentUserId) return
		handleCloseUserMenu()
		const activeElement = document.activeElement as HTMLElement | null
		activeElement?.blur()
		dispatch(setPopup(PopupState.PROFILE))
		await loadProfileUser(currentUserId)
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
		{ text: "menu.setting.button", icon: "fa-gear", click: handleShowSettings },
		...(isInRoom ? [{ text: "Restart", icon: "fa-rotate", click: handleRestart }] : []),
	]

	const toogleDrawerClass = classnames("fas", {
		"fa-chevrons-right": !drawerOpen,
		"fa-chevrons-left": drawerOpen,
		"icon-toogle-drawer": true
	})

	const drawerContent = (
		<>
			<Toolbar>
				<TTypography
					variant="h6"
					noWrap
					component="div"
					sx={{ fontWeight: "bold" }}
					content="menu.app-name"
				/>
			</Toolbar>

			<List>
				{menuItems.map(item => (
					<ListItem key={item.text} disablePadding>
						<ListItemButton onClick={item.click}>
							<TI className={`fas ${item.icon} mr-10 fsx-20`} title={item.text} />
							{drawerOpen && <TTypography content={item.text} sx={{ fontSize: 14 }} />}
						</ListItemButton>
					</ListItem>
				))}
			</List>

			<Divider sx={{ mt: "auto" }} />

			<List>
				<ListItem disablePadding>
					<ListItemButton onClick={logoutClick}>
						<i className="fas fa-right-from-bracket" />
						{drawerOpen && <TTypography content="menu.logout" sx={{ fontSize: 14, ml: 1 }} />}
					</ListItemButton>
					<i className={toogleDrawerClass} onClick={handleDrawerToggle} />
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
					sx={{
						textTransform: "none",
						display: "flex",
						gap: 1,
						borderRadius: 2,
						backgroundColor: "background.paper",
						boxShadow: 1,
						pl: 1,
						pr: 1.5
					}}
				>
					<Avatar src={userImage} alt={displayName} className="user-avatar-small" />
					<span>{displayName}</span>
				</Button>

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
					<MenuItem onClick={handleGoProfile} sx={{ gap: 1 }}>
						<i className="fas fa-user fsx-14" />
						{translate("menu.profile")}
					</MenuItem>
					{showDebugMenu && <Divider />}
					{showDebugMenu && (
						<MenuItem onClick={handleMakeExpired} sx={{ gap: 1 }}>
							<i className="fas fa-clock fsx-14" />
							{translate("menu.expired")}
						</MenuItem>
					)}
					<Divider />
					<MenuItem onClick={handleLogoutFromMenu} sx={{ gap: 1 }}>
						<i className="fas fa-right-from-bracket fsx-14" />
						{translate("menu.logout")}
					</MenuItem>
				</Menu>
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
						<TSpan content={displayName} />
					</Button>
				</Toolbar>
			</AppBar>}

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
					onClose={handleMobileToggle}
					sx={{
						display: { xs: "block", sm: "none" },
						"& .MuiDrawer-paper": { boxSizing: "border-box", width: drawerOpen ? fullWidth : miniWidth },
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
			<PopupProvider value={{ profileUser, setProfileUser }}>
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

					<GameHistoryPopup />
					<GuidePopup />
					<ProfilePopup />
					<SettingsPopup />
				</Box>
			</PopupProvider>
		</Box>
	)
}
