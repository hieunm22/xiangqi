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
import i18n from "locales/i18n"
import { COUNTRIES_DROPDOWN, LS_DARKMODE, LS_LANGUAGE } from "common/constant"
import { TTypography } from "components/TranslationTag"
import { ComboBoxWithLabel } from "components/ComboBoxWithLabel"
import useToolkit from "hooks/useToolkit"
import { setDarkMode } from "toolkit/slice/home"
import { translate } from "locales/translate"
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
	}

	return (
		<Box sx={{ display: "flex" }}>
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
	)
}
