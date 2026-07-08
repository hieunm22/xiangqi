import { ChangeEvent, useEffect, useState } from "react"
import {
	Dialog,
	DialogContent,
	DialogTitle,
	Divider,
	Grid,
	Button,
	CircularProgress,
	Switch
} from "@mui/material"
import {
	COUNTRIES_OPTIONS,
	LS_DARKMODE,
	LS_DEBUG,
	LS_LANGUAGE
} from "common/constant"
import { PopupState } from "common/enums"
import { TButton, TSpan, TTypography } from "components/TranslationTag"
import { getToken } from "common/helper"
import { useAPI } from "hooks/useAPI"
import { useFacebookAuth } from "hooks/useFacebookAuth"
import useToolkit from "hooks/useToolkit"
import i18n from "locales/i18n"
import { translate } from "locales/translate"
import { setPopup } from "toolkit/slice/game"
import { setDebug, setDarkMode, setLanguage } from "toolkit/slice/home"

const FACEBOOK_PROVIDER = "facebook"

export const SettingsPopup = () => {
	const { state, gameState, dispatch } = useToolkit()
	const setDarkModeAction = (darkMode: boolean) => dispatch(setDarkMode(darkMode))

	const { facebookLink, facebookUnlink, getLinkedProviders } = useAPI()
	const { login: facebookSdkLogin, isConfigured: isFacebookConfigured } = useFacebookAuth()
	const [isFacebookLinked, setIsFacebookLinked] = useState(false)
	const [facebookLoading, setFacebookLoading] = useState(false)
	const [facebookFeedback, setFacebookFeedback] = useState<string | null>(null)

	const isSettingsOpen = gameState.popupState === PopupState.SETTINGS

	useEffect(() => {
		const isDarkMode = localStorage.getItem(LS_DARKMODE) === "dark"
		setDarkModeAction(isDarkMode)

		const savedLang = localStorage.getItem(LS_LANGUAGE) || "en"
		dispatch(setLanguage(savedLang))

		const debugMode = localStorage.getItem(LS_DEBUG) === "1"
		dispatch(setDebug(debugMode))
	}, [])

	// Refresh linked-provider status each time the dialog opens.
	useEffect(() => {
		if (!isSettingsOpen || !isFacebookConfigured) return

		const token = getToken()
		if (!token) return

		let cancelled = false
		setFacebookFeedback(null)
		getLinkedProviders(token).then(response => {
			if (cancelled) return
			const providers: string[] = response?.data?.providers ?? []
			setIsFacebookLinked(providers.includes(FACEBOOK_PROVIDER))
		})

		return () => {
			cancelled = true
		}
	}, [isSettingsOpen, isFacebookConfigured])

	const handleLinkFacebook = async () => {
		setFacebookFeedback(null)

		let fbAccessToken: string
		try {
			fbAccessToken = await facebookSdkLogin()
		} catch {
			// User cancelled the Facebook popup or the SDK failed to load.
			return
		}

		const token = getToken()
		if (!token) return

		setFacebookLoading(true)
		try {
			const response = await facebookLink(token, fbAccessToken)
			if (response?.success) {
				setIsFacebookLinked(true)
				setFacebookFeedback("settings.connected-accounts.link-success")
			} else {
				setFacebookFeedback(response?.message || "settings.connected-accounts.link-error")
			}
		} finally {
			setFacebookLoading(false)
		}
	}

	const handleUnlinkFacebook = async () => {
		setFacebookFeedback(null)
		const token = getToken()
		if (!token) return

		setFacebookLoading(true)
		try {
			const response = await facebookUnlink(token)
			if (response?.success) {
				setIsFacebookLinked(false)
				setFacebookFeedback("settings.connected-accounts.unlink-success")
			} else {
				setFacebookFeedback(response?.message || "settings.connected-accounts.link-error")
			}
		} finally {
			setFacebookLoading(false)
		}
	}

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

	return (
		<Dialog
			open={gameState.popupState === PopupState.SETTINGS}
			onClose={handleCloseSettings}
			className="settings-dialog"
			disableEnforceFocus
		>
			<DialogTitle className="popup-title">
				<TTypography content="settings.header" className="settings-title" />
			</DialogTitle>
			<Divider className="settings-divider" />
			<DialogContent className="dialog-content">
				<Grid container className="setting-row setting-row-aligned">
					<TTypography className="setting-label" content="settings.language" />
					<Grid container className="setting-options-grid">
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
					<TTypography className="setting-label-fixed" content="settings.dark-mode" />
					<Switch
						className="ios-switch"
						checked={state.darkMode}
						onChange={toogleDarkMode}
					/>
				</Grid>
				<Grid container className="setting-row">
					<TTypography className="setting-label-fixed" content="settings.debug-mode" />
					<Switch
						className="ios-switch"
						checked={state.debugMode}
						onChange={toogleDebugMode}
					/>
				</Grid>
				{isFacebookConfigured && (
					<Grid container className="setting-row setting-row-aligned">
						<TTypography className="setting-label" content="settings.connected-accounts.label" />
						<Button
							variant={isFacebookLinked ? "outlined" : "contained"}
							color={isFacebookLinked ? "error" : "primary"}
							size="small"
							disabled={facebookLoading}
							onClick={isFacebookLinked ? handleUnlinkFacebook : handleLinkFacebook}
							startIcon={facebookLoading
								? <CircularProgress size={16} color="inherit" />
								: <i className="fab fa-facebook-f" />}
						>
							{translate(isFacebookLinked
								? "settings.connected-accounts.unlink-facebook"
								: "settings.connected-accounts.link-facebook")}
						</Button>
						{facebookFeedback && (
							<TSpan className="setting-feedback" content={facebookFeedback} />
						)}
					</Grid>
				)}
			</DialogContent>
			<Divider className="settings-divider" />
			<Grid container className="settings-footer">
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
