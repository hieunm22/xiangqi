import { SubmitEvent, useEffect, useState } from "react"
import classnames from "classnames"
import {
	Box,
	CircularProgress,
	Divider,
	Link,
	Paper,
	Stack
} from "@mui/material"
import { Link as RouterLink, useNavigate } from "react-router-dom"
import { HOME_PATH, LS_TOKEN_KEY } from "common/constant"
import Alert from "components/AlertWithIcon"
import { TButton, TI, TTextField, TTypography } from "components/TranslationTag"
import { useAPI } from "hooks/useAPI"
import useAutoTitle from "hooks/useAutoTitle"
import { useAuth } from "hooks/useAppContext"
import { useFacebookAuth } from "hooks/useFacebookAuth"
import { useGoogleAuth } from "hooks/useGoogleAuth"
import { translate } from "locales/translate"
import { AuthResponse } from "./types"
import "./Login.scss"

export default function LoginPage() {
	useAutoTitle(translate("login.page.title"))
	const [username, setUsername] = useState("")
	const [password, setPassword] = useState("")
	const [userNameError, setUsernameError] = useState<string | null>(null)
	const [passwordError, setPasswordError] = useState<string | null>(null)
	const [showPassword, setShowPassword] = useState(false)
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [message, setMessage] = useState<string | null>(null)
	const { facebookLogin, googleLogin, login } = useAPI()
	const navigate = useNavigate()
	const { markAuthenticated } = useAuth()

	useEffect(() => {
		// is this check development environment correct?
		if (import.meta.env.DEV) {
			setUsername("1")
			setPassword("1")
		}
	}, [])

	const onChangeUsername = (event: React.ChangeEvent<HTMLInputElement>) => {
		setUsername(event.target.value)
		if (event.target.value.trim()) {
			setUsernameError(null)
		}
	}

	const onChangePassword = (event: React.ChangeEvent<HTMLInputElement>) => {
		setPassword(event.target.value)
		if (event.target.value.trim()) {
			setPasswordError(null)
		}
	}

	const applyAuthResponse = async (response: AuthResponse) => {
		if (!response.success) {
			throw new Error(translate(response.message || "login.form.error1"))
		}

		setMessage(translate(response.message || "login.form.success"))
		localStorage.setItem(LS_TOKEN_KEY, response.access_token)
		markAuthenticated()
		navigate(HOME_PATH)
	}

	const handleSubmit = async (e: SubmitEvent<HTMLFormElement>) => {
		e.preventDefault()
		setError(null)
		setMessage(null)
		setLoading(true)
		if (!username.trim()) {
			setUsernameError(translate("common.input.is-required"))
			setLoading(false)
			return
		}
		if (!password.trim()) {
			setPasswordError(translate("common.input.is-required"))
			setLoading(false)
			return
		}

		try {
			const response: AuthResponse = await login({
				username,
				password,
				deviceName: navigator.userAgent,
				timezoneOffset: new Date().getTimezoneOffset() / -60
			})
			await applyAuthResponse(response)
		} catch (submitError) {
			setLoading(false)
			const submitMessage = submitError instanceof Error
				? translate(submitError.message)
				: translate("login.form.unexpected-error")
			setError(submitMessage)
		} finally {
			setLoading(false)
		}
	}

	const handleGoogleCredential = async (credential: string) => {
		setError(null)
		setMessage(null)
		setLoading(true)

		try {
			const response: AuthResponse = await googleLogin({
				credential,
				deviceName: navigator.userAgent,
				timezoneOffset: new Date().getTimezoneOffset() / -60
			})
			await applyAuthResponse(response)
		} catch (submitError) {
			const submitMessage = submitError instanceof Error
				? translate(submitError.message)
				: translate("login.form.unexpected-error")
			setError(submitMessage)
		} finally {
			setLoading(false)
		}
	}

	const { buttonRef: googleButtonRef, isConfigured: isGoogleConfigured } = useGoogleAuth({
		onCredential: handleGoogleCredential,
		onError: () => setError(translate("login.google.load-error"))
	})

	const { login: facebookSdkLogin, isConfigured: isFacebookConfigured } = useFacebookAuth()

	const handleFacebookLogin = async () => {
		setError(null)
		setMessage(null)

		let accessToken: string
		try {
			accessToken = await facebookSdkLogin()
		} catch {
			// User closed the Facebook popup or the SDK failed to load — stay put.
			return
		}

		setLoading(true)
		try {
			const response: AuthResponse = await facebookLogin({
				accessToken,
				deviceName: navigator.userAgent,
				timezoneOffset: new Date().getTimezoneOffset() / -60
			})
			await applyAuthResponse(response)
		} catch (submitError) {
			const submitMessage = submitError instanceof Error
				? translate(submitError.message)
				: translate("login.form.unexpected-error")
			setError(submitMessage)
		} finally {
			setLoading(false)
		}
	}

	const eyeIconClass = classnames("show-password fas", {
		"fa-eye": !showPassword,
		"fa-eye-slash": showPassword
	})

	return (
		<Box className="unauth-form-container">
			<Paper elevation={4} className="unauth-form-paper-container">
				<Stack component="form" spacing={2} onSubmit={handleSubmit}>
					<TTypography
						variant="h5"
						component="h1"
						sx={{ fontWeight: 700 }}
						content="login.form.title"
					/>
					<TTextField
						label="login.username.label"
						placeholder="login.username.placeholder"
						variant="standard"
						name="username"
						autoFocus
						value={username}
						onChange={onChangeUsername}
						fullWidth
						error={!!userNameError}
						helperText={userNameError}
						slotProps={{
							input: {
								startAdornment: (
									<i className="fas fa-user start-icon" />
								)
							}
						}}
					/>

					<TTextField
						label="login.password.label"
						placeholder="login.password.placeholder"
						variant="standard"
						name="password"
						type={showPassword ? "text" : "password"}
						value={password}
						onChange={onChangePassword}
						fullWidth
						error={!!passwordError}
						helperText={passwordError}
						slotProps={{
							input: {
								startAdornment: (
									<i className="fas fa-lock start-icon" />
								),
								endAdornment: (
									<TI
										className={eyeIconClass}
										title={showPassword ? "login.password.hide" : "login.password.show"}
										onClick={() => setShowPassword(prev => !prev)}
									/>
								)
							}
						}}
					/>

					<Stack direction="row" spacing={2} sx={{ justifyContent: "space-between" }}>
						<Link component={RouterLink} to="/lost-password" underline="hover" variant="body2">
							{translate("login.form.forgot-password")}
						</Link>
						<Link component={RouterLink} to="/register" underline="hover" variant="body2">
							{translate("login.form.register")}
						</Link>
					</Stack>

					{error && <Alert severity="error">{error}</Alert>}
					{message && <Alert severity="success">{message}</Alert>}

					<TButton
						type="submit"
						variant="contained"
						disabled={loading}
						fullWidth
						size="large"
						value="login.form.submit"
						startIcon={loading ? <CircularProgress size={22} color="inherit" /> : null}
					/>

					{(isGoogleConfigured || isFacebookConfigured) && (
						<Divider sx={{ color: "text.secondary", fontSize: 13 }}>
							{translate("login.form.or")}
						</Divider>
					)}
					{isGoogleConfigured && (
						<Box ref={googleButtonRef} className="google-signin-wrapper" />
					)}
					{isFacebookConfigured && (
						<TButton
							variant="contained"
							fullWidth
							size="large"
							disabled={loading}
							onClick={handleFacebookLogin}
							startIcon={<i className="fab fa-facebook-f" />}
							className="facebook-signin-btn"
							value="login.facebook.button"
						/>
					)}
				</Stack>
			</Paper>
		</Box>
	)
}
