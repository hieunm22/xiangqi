import { ChangeEvent, useEffect, useState } from "react"
import { Outlet } from "react-router-dom"
import {
	Box,
	CssBaseline,
	DialogContent,
	DialogTitle,
	Divider,
	Grid,
	Switch
} from "@mui/material"
import landscapeBg from "assets/landscape.PNG?url"
import portraitBg from "assets/portrait.jpg?url"
import { COUNTRIES_OPTIONS, LS_DARKMODE, LS_LANGUAGE } from "common/constant"
import { ResponsiveDialog } from "components/ResponsiveDialog"
import { TButton, TTypography } from "components/TranslationTag"
import useToolkit from "hooks/useToolkit"
import i18n from "locales/i18n"
import { setDarkMode } from "toolkit/slice/home"
import "./LayoutUnAuth.scss"

export default function LayoutUnAuth() {
	const [language, setLanguage] = useState("en")
	const [openSettings, setOpenSettings] = useState(false)
	const { state, dispatch } = useToolkit()

	const setDarkModeAction = (darkMode: boolean) => dispatch(setDarkMode(darkMode))

	useEffect(() => {
		const isDarkMode = localStorage.getItem(LS_DARKMODE) === "dark"
		setDarkModeAction(isDarkMode)
		const lang = localStorage.getItem(LS_LANGUAGE) || "en"
		setLanguage(lang)
		i18n.changeLanguage(lang)
	}, [])

	useEffect(() => {
		document.documentElement.style.setProperty("--layout-bg-image", `url(${landscapeBg})`)
		document.documentElement.style.setProperty("--layout-bg-image-mobile", `url(${portraitBg})`)

		return () => {
			document.documentElement.style.removeProperty("--layout-bg-image")
			document.documentElement.style.removeProperty("--layout-bg-image-mobile")
		}
	}, [])

	const onChangeLanguage = (lang: string) => {
		setLanguage(lang)
		i18n.changeLanguage(lang)
		localStorage.setItem(LS_LANGUAGE, lang)
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
	}

	return (
		<Box className="layout-unauth layout-bg-shell">
			<CssBaseline />
			<Outlet />
			<TButton
				className="unauth-setting-btn"
				variant="contained"
				startIcon={<i className="fa-solid fa-gear" />}
				size="small"
				sx={{ backgroundColor: "background.default", color: "text.primary" }}
				onClick={handleShowSettings}
				value="menu.setting.button"
			/>

			<ResponsiveDialog
				drawerAnchor="top"
				open={openSettings}
				onClose={handleCloseSettings}
				maxWidth="xs"
				disableRestoreFocus
			>
				<DialogTitle className="setting-title">
					<TTypography content="settings.header" sx={textCenterStyle} />
				</DialogTitle>
				<Divider className="divider" />
				<DialogContent className="dialog-content">
					<Grid container className="setting-row">
						<TTypography sx={{ width: 100 }} content="settings.language" />
						<Grid container sx={{ gap: 1 }}>
							{COUNTRIES_OPTIONS.map(option => (
								<TButton
									key={option.key}
									variant={language === option.key ? "contained" : "outlined"}
									disabled={option.disabled}
									onClick={() => onChangeLanguage(option.key)}
									startIcon={
										<img
											src={option.icon}
											alt={option.value}
											style={{ width: 20, height: 20 }}
										/>
									}
									size="small"
									value={option.value}
								/>
							))}
						</Grid>
					</Grid>
					<Grid container className="setting-row">
						<TTypography content="settings.dark-mode" sx={{ width: 100 }} />
						<Switch
							className="ios-switch"
							checked={state.darkMode}
							onChange={toogleDarkMode}
						/>
					</Grid>
					<Divider className="menu-divider" />
					<Grid container sx={{ justifyContent: "center" }}>
						<TButton
							className="btn btn-primary setting-button"
							variant="outlined"
							size="small"
							onClick={() => setOpenSettings(false)}
							startIcon={<i className="fas fa-xmark" />}
							value="settings.close"
						/>
					</Grid>
				</DialogContent>
			</ResponsiveDialog>
		</Box>
	)
}
