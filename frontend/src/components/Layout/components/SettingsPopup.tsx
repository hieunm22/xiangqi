import { ChangeEvent, useEffect, useState } from "react"
import {
	Dialog,
	DialogContent,
	DialogTitle,
	Divider,
	Grid,
	Switch
} from "@mui/material"
import { COUNTRIES_DROPDOWN, LS_DARKMODE, LS_LANGUAGE } from "common/constant"
import { ComboBoxWithLabel } from "components/ComboBoxWithLabel"
import { TButton, TTypography } from "components/TranslationTag"
import { usePopups } from "../context"
import useToolkit from "hooks/useToolkit"
import { setDarkMode } from "toolkit/slice/home"
import i18n from "locales/i18n"

export const SettingsPopup = () => {
	const [language, setLanguage] = useState("en")
	const { openSettings, setOpenSettings } = usePopups()
	const { state, dispatch } = useToolkit()
	const setDarkModeAction = (darkMode: boolean) => dispatch(setDarkMode(darkMode))

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

	return (
		<Dialog
			open={openSettings}
			onClose={handleCloseSettings}
			maxWidth="xs"
			disableRestoreFocus
		>
			<DialogTitle padding="5px 20px !important">
				<TTypography content="settings.header" sx={textCenterStyle} />
			</DialogTitle>
			<Divider className="settings-dialog-divider" />
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
					<TButton
						className="btn btn-primary mt-20 center"
						variant="outlined"
						size="small"
						onClick={() => setOpenSettings(false)}
						value="settings.close"
					/>
				</Grid>
			</DialogContent>
		</Dialog>
	)
}