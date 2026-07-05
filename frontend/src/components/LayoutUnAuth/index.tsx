import { ChangeEvent, useEffect, useState } from "react"
import { Outlet } from "react-router-dom"
import {
	Box,
	Button,
	CssBaseline,
	Dialog,
	DialogContent,
	DialogTitle,
	Divider,
	Grid,
	Switch
} from "@mui/material"
import landscapeBg from "assets/landscape.PNG?url"
import portraitBg from "assets/portrait.jpg?url"
import { COUNTRIES_OPTIONS, LS_DARKMODE, LS_LANGUAGE } from "common/constant"
import { TTypography } from "components/TranslationTag"
import useToolkit from "hooks/useToolkit"
import i18n from "locales/i18n"
import { translate } from "locales/translate"
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
		<Box
			className="layout-unauth"
			sx={{
				backgroundImage: `url(${landscapeBg})`,
				"@media (max-width: 450px)": {
					backgroundImage: `url(${portraitBg})`
				}
			}}
		>
			<CssBaseline />
			<Outlet />
			<Button
				className="unauth-setting-btn"
				variant="outlined"
				startIcon={<i className="fa-solid fa-gear" />}
				size="small"
				onClick={handleShowSettings}
			>
				{translate("menu.setting.button")}
			</Button>

			<Dialog
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
								<Button
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
								>
									{option.value}
								</Button>
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
					<Grid container sx={{ justifyContent: "center" }}>
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
	)
}
