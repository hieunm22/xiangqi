import { ChangeEvent, useEffect, useState } from "react"
import { Outlet, useNavigate } from "react-router-dom"
import classnames from "classnames"
import {
	AppBar,
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
	Switch,
	Toolbar,
	useMediaQuery,
	useTheme
} from "@mui/material"
import i18n from "locales/i18n"
import {
	COUNTRIES_DROPDOWN,
	LS_CAPTURED_PIECES,
	LS_DARKMODE,
	LS_LANGUAGE
} from "common/constant"
import { TI, TTypography } from "components/TranslationTag"
import { ComboBoxWithLabel } from "components/ComboBoxWithLabel"
import { initNewGame } from "common/helper"
import useToolkit from "hooks/useToolkit"
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
	const navigate = useNavigate()
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
		localStorage.setItem(LS_CAPTURED_PIECES, JSON.stringify({ red: [], black: [] }))
	}

	const menuItems = [
		{ text: "menu.home", icon: "fa-home", click: () => navigate("/") },
		{ text: "menu.users", icon: "fa-users", click: () => navigate("/users"), disabled: true },
		{ text: "menu.analytics", icon: "fa-chart-mixed", click: () => navigate("/analytics"), disabled: true },
		{ text: "menu.setting.button", icon: "fa-gear", click: handleShowSettings },
		...(!isMobile ? [{ text: "Restart", icon: "fa-rotate", click: restartGame }] : [])
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
						<ListItemButton onClick={item.click} disabled={item.disabled}>
							<TI className={`fas ${item.icon} mr-10 fsx-20`} title={item.text} />
							{drawerOpen && <TTypography content={item.text} sx={{ fontSize: 14 }} />}
						</ListItemButton>
					</ListItem>
				))}
			</List>

			<Divider sx={{ mt: "auto" }} />

			<List>
				<ListItem disablePadding>
					<ListItemButton>
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

			{isMobile && <AppBar position="fixed" sx={{ width: "100%" }}>
				<Toolbar>
					<IconButton color="inherit" edge="start" onClick={handleMobileToggle} sx={{ mr: 2 }}>
						<i className="fas fa-bars" />
					</IconButton>
					<Box sx={{ flexGrow: 1 }} />
					<IconButton color="inherit" edge="end" onClick={restartGame} aria-label="restart game">
						<i className="fas fa-rotate" />
					</IconButton>
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
