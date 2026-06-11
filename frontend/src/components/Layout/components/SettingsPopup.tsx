import { ChangeEvent, useEffect } from "react"
import {
	Dialog,
	DialogContent,
	DialogTitle,
	Divider,
	Grid,
	Button,
	Switch
} from "@mui/material"
import {
	COUNTRIES_OPTIONS,
	LS_DARKMODE,
	LS_DEBUG,
	LS_LANGUAGE
} from "common/constant"
import { PopupState } from "../enums"
import { TButton, TTypography } from "components/TranslationTag"
import useToolkit from "hooks/useToolkit"
import i18n from "locales/i18n"
import { setDebug, setPopup } from "toolkit/slice/game"
import { setDarkMode, setLanguage } from "toolkit/slice/home"

export const SettingsPopup = () => {
	const { state, gameState, dispatch } = useToolkit()
	const setDarkModeAction = (darkMode: boolean) => dispatch(setDarkMode(darkMode))

	useEffect(() => {
		const isDarkMode = localStorage.getItem(LS_DARKMODE) === "dark"
		setDarkModeAction(isDarkMode)

		const savedLang = localStorage.getItem(LS_LANGUAGE) || "en"
		dispatch(setLanguage(savedLang))

		const debugMode = localStorage.getItem(LS_DEBUG) === "1"
		dispatch(setDebug(debugMode))
	}, [])

	const toogleDarkMode = (e: ChangeEvent<HTMLElement>) => {
		e.stopPropagation()
		const isDarkMode = localStorage.getItem(LS_DARKMODE) === "dark"
		setDarkModeAction(!isDarkMode)
		localStorage.setItem(LS_DARKMODE, isDarkMode ? "light" : "dark")
	}

	const toogleDebugMode = (e: ChangeEvent<HTMLElement>) => {
		e.stopPropagation()
		const isDebugMode = localStorage.getItem(LS_DEBUG) === "1"
		dispatch(setDebug(!isDebugMode))
		localStorage.setItem(LS_DEBUG, isDebugMode ? "0" : "1")
	}

	const handleLanguageChange = (languageCode: string) => {
		i18n.changeLanguage(languageCode)
		localStorage.setItem(LS_LANGUAGE, languageCode)
		dispatch(setLanguage(languageCode))
	}

	const closeSettings = () => dispatch(setPopup(PopupState.NONE))

	const handleCloseSettings = (_: any, reason: "backdropClick" | "escapeKeyDown") => {
		if (reason === "escapeKeyDown") {
			closeSettings()
		}
	}

	const textCenterStyle = {
		display: "flex",
		justifyContent: "center",
		alignItems: "center"
	}

	return (
		<Dialog
			open={gameState.popupState === PopupState.SETTINGS}
			onClose={handleCloseSettings}
			maxWidth="xs"
			disableEnforceFocus
		>
			<DialogTitle className="settings-popup-title">
				<TTypography content="settings.header" sx={textCenterStyle} />
			</DialogTitle>
			<Divider sx={{ borderColor: "primary.main" }} />
			<DialogContent className="dialog-content">
				<Grid container className="setting-row" alignItems="center" gap={2}>
					<TTypography sx={{ minWidth: "100px" }} content="settings.language" />
					<Grid container gap={1}>
						{COUNTRIES_OPTIONS.map(option => (
							<Button
								key={option.key}
								variant={state.lang === option.key ? "contained" : "outlined"}
								disabled={option.disabled}
								onClick={() => handleLanguageChange(option.key)}
								startIcon={
									option.icon && (
										<img
											src={option.icon}
											alt={option.value}
											style={{ width: 20, height: 20 }}
										/>
									)
								}
								size="small"
							>
								{option.value}
							</Button>
						))}
					</Grid>
				</Grid>
				<Grid container className="setting-row">
					<TTypography content="settings.dark-mode" width={100} />
					<Switch
						className="ios-switch"
						checked={state.darkMode}
						onChange={toogleDarkMode}
					/>
				</Grid>
				<Grid container className="setting-row">
					<TTypography content="settings.debug-mode" width={100} />
					<Switch
						className="ios-switch"
						checked={gameState.debugMode}
						onChange={toogleDebugMode}
					/>
				</Grid>
			</DialogContent>
			<Divider sx={{ borderColor: "primary.main" }} />
			<Grid container justifyContent="center">
				<TButton
					className="btn btn-primary mt-12 mb-12 center"
					variant="outlined"
					size="small"
					onClick={closeSettings}
					value="settings.close"
				/>
			</Grid>
		</Dialog>
	)
}
