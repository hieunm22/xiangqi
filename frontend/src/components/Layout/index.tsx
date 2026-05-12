import { ChangeEvent, useEffect, useState } from "react"
import { Outlet, useNavigate, useLocation } from "react-router-dom"
import classnames from "classnames"
import {
	AppBar,
	Avatar,
	Box,
	Button,
	CssBaseline,
	Dialog,
	DialogContent,
	DialogTitle,
	Divider,
	Drawer,
	Grid,
	IconButton,
	List,
	ListItem,
	ListItemButton,
	Menu,
	MenuItem,
	Switch,
	Toolbar,
	useMediaQuery,
	useTheme
} from "@mui/material"
import i18n from "locales/i18n"
import {
	COUNTRIES_DROPDOWN,
	HOME_PATH,
	LOGIN_PATH,
	LS_DARKMODE,
	LS_LANGUAGE,
	LS_TOKEN_KEY
} from "common/constant"
import { TI, TTypography } from "components/TranslationTag"
import { ComboBoxWithLabel } from "components/ComboBoxWithLabel"
import { decodePayload, getToken, initNewGame, requireImage } from "common/helper"
import useToolkit from "hooks/useToolkit"
import { useAPI } from "hooks/useAPI"
import { setDarkMode } from "toolkit/slice/home"
import { translate } from "locales/translate"
import { setGameState } from "toolkit/slice/game"
import "./Layout.scss"

const fullWidth = 240
const miniWidth = 60

export default function Layout() {
	const [drawerOpen, setDrawerOpen] = useState(true)
	const [language, setLanguage] = useState("en")
	const [mobileOpen, setMobileOpen] = useState(false)
	const [openSettings, setOpenSettings] = useState(false)
	const [userMenuAnchor, setUserMenuAnchor] = useState<null | HTMLElement>(null)
	const [userDisplayName, setUserDisplayName] = useState("")
	const [userImage, setUserImage] = useState("")
	const navigate = useNavigate()
	const location = useLocation()
	const { getUserById, leaveRoom, logout } = useAPI()
	const { state, dispatch } = useToolkit()
	const theme = useTheme()
	const isMobile = useMediaQuery(theme.breakpoints.down("sm"))

	const setDarkModeAction = (darkMode: boolean) => dispatch(setDarkMode(darkMode))
	const handleMobileToggle = () => setMobileOpen(!mobileOpen)
	const handleDrawerToggle = () => setDrawerOpen(!drawerOpen)

	useEffect(() => {
		if (openSettings) {
			const lang = localStorage.getItem(LS_LANGUAGE) || "en"
			setLanguage(lang)
		}
	}, [openSettings])

	useEffect(() => {
		const isDarkMode = localStorage.getItem(LS_DARKMODE) === "dark"
		setDarkModeAction(isDarkMode)
	}, [])

	useEffect(() => {
		const getUserInfo = async () => {
			const token = getToken()
			const claims = decodePayload(token)
			if (!claims?.sub) return

			const user = await getUserById(claims.sub)
			if (!user?.data) return
			const { id, display_name, avatar_seq } = user.data
			const avatarPath = avatar_seq === 0
				? `/images/${id}.jpg`
				: `/images/${id}_${avatar_seq}.jpg`

			const avatar = requireImage(avatarPath)
			setUserImage(avatar)
			setUserDisplayName(display_name)
		}

		getUserInfo()
	}, [])

	const onChangeLanguage = (e: any) => {
		setLanguage(e.target.value)
		i18n.changeLanguage(e.target.value)
		localStorage.setItem(LS_LANGUAGE, e.target.value)
	}

	const toogleDarkMode = (e: ChangeEvent<HTMLElement>) => {
		e.stopPropagation()
		const isDarkMode = localStorage.getItem(LS_DARKMODE) === "dark"
		setDarkModeAction(!isDarkMode)
		localStorage.setItem(LS_DARKMODE, isDarkMode ? "light" : "dark")
	}

	const handleCloseSettings = (_: any, reason: "backdropClick" | "escapeKeyDown") => {
		if (reason === "escapeKeyDown") {
			setOpenSettings(false)
		}
	}

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
			navigate(LOGIN_PATH)
		}
	}

	const textCenterStyle = {
		display: "flex",
		justifyContent: "center",
		alignItems: "center"
	}

	const handleShowSettings = () => {
		(document.activeElement as HTMLElement)?.blur()
		setOpenSettings(true)
		setMobileOpen(false)
	}

	const restartGame = () => {
		const init = initNewGame()
		dispatch(setGameState(init))
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
		navigate("/profile?id=1")
		handleCloseUserMenu()
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

	const showRestart = !isMobile && location.pathname.startsWith("/room/")
	const menuItems = [
		{ text: "menu.home", icon: "fa-home", click: handleGoHome },
		{ text: "menu.setting.button", icon: "fa-gear", click: handleShowSettings },
		...(showRestart ? [{ text: "Restart", icon: "fa-rotate", click: restartGame }] : [])
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
		<Box sx={{ display: "flex" }}>
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
					<Avatar src={userImage} alt={displayName} sx={{ width: 28, height: 28 }} />
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
					<Divider />
					<MenuItem onClick={logoutClick} sx={{ gap: 1 }}>
						<i className="fas fa-right-from-bracket fsx-14" />
						{translate("menu.logout")}
					</MenuItem>
				</Menu>
			</Box>

			{isMobile && <AppBar position="fixed" sx={{ width: "100%" }}>
				<Toolbar>
					<IconButton color="inherit" edge="start" onClick={handleMobileToggle} sx={{ mr: 2 }}>
						<i className="fas fa-bars" />
					</IconButton>
					<Box sx={{ flexGrow: 1 }} />
					{location.pathname.startsWith("/room") && (
						<IconButton color="inherit" onClick={restartGame}>
							<i className="fas fa-rotate" />
						</IconButton>
					)}
					<Button
						onClick={handleOpenUserMenu}
						variant="outlined"
						size="small"
						sx={{
							textTransform: "none",
							display: "flex",
							gap: 1,
							borderRadius: 2,
							color: "inherit",
							borderColor: "rgba(255,255,255,0.5)",
							pl: 1,
							pr: 1.5,
							ml: 1
						}}
					>
						<Avatar src={userImage} alt={displayName} sx={{ width: 24, height: 24 }} />
						<span>{displayName}</span>
					</Button>
				</Toolbar>
			</AppBar>}

			{/* Navigation */}
			<Box component="nav" sx={{ width: { sm: drawerOpen ? fullWidth : miniWidth }, flexShrink: { sm: 0 } }}>
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

			{/* Main content */}
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

				<Dialog
					open={openSettings}
					onClose={handleCloseSettings}
					maxWidth="xs"
					disableRestoreFocus
				>
					<DialogTitle padding="5px 20px !important">
						<TTypography content="settings.header" sx={textCenterStyle} />
					</DialogTitle>
					<Divider sx={{ my: "5px" }} />
					<DialogContent className="dialog-content">
						<Grid container className="setting-row">
							<TTypography sx={{ minWidth: "100px" }} content="settings.language" />
							<ComboBoxWithLabel
								id="language"
								options={COUNTRIES_DROPDOWN}
								value={language}
								change={onChangeLanguage}
							/>
						</Grid>
						<Grid container className="setting-row">
							<TTypography content="settings.dark-mode" />
							<Switch
								className="ios-switch"
								checked={state.darkMode}
								onChange={toogleDarkMode}
							/>
						</Grid>
						<Grid container justifyContent="center">
							<Button
								className="btn btn-primary mt-20 center"
								variant="outlined"
								size="small"
								onClick={() => setOpenSettings(false)}
							>
								{translate("settings.close")}
							</Button>
						</Grid>
					</DialogContent>
				</Dialog>
			</Box>
		</Box>
	)
}
