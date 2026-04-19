import { FormEvent, useState } from "react"
import classnames from "classnames"
import {
	Alert,
	Box,
	Button,
	CircularProgress,
	InputAdornment,
	Link,
	Paper,
	Stack,
	Typography
} from "@mui/material"
import { Link as RouterLink } from "react-router-dom"
import { TI, TTextField } from "components/TranslationTag"
import { translate } from "locales/translate"
import "./Login.scss"

export default function LoginPage() {
	const [username, setUsername] = useState("")
	const [password, setPassword] = useState("")
	const [userNameError, setUsernameError] = useState<string | null>(null)
	const [passwordError, setPasswordError] = useState<string | null>(null)
	const [showPassword, setShowPassword] = useState(false)
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [message, setMessage] = useState<string | null>(null)

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

	const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
		e.preventDefault()
		setError(null)
		setMessage(null)
		setLoading(true)
		if (!username.trim()) {
			setUsernameError(translate("login.username.error1"))
			return
		}
		if (!password.trim()) {
			setPasswordError(translate("login.password.error1"))
			return
		}

		try {
			// TODO: Replace with the real authentication endpoint and token/session handling.
			const response = await fetch("/api/login", {
				method: "POST",
				headers: {
					"Content-Type": "application/json"
				},
				body: JSON.stringify({ username, password })
			})

			if (!response.ok) {
				throw new Error(translate("login.form.error1"))
			}

			setMessage(translate("login.form.success"))
		} catch (submitError) {
			const submitMessage =
				submitError instanceof Error ? submitError.message : "Unexpected error while logging in."
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
		<Box
			sx={{
				minHeight: "100vh",
				display: "flex",
				alignItems: "center",
				width: "100%",
				justifyContent: "center",
			}}
		>
			<Paper elevation={4} sx={{ width: "100%", maxWidth: 450, p: 4, borderRadius: 3 }}>
				<Stack component="form" spacing={2.5} onSubmit={handleSubmit}>
					<Typography variant="h5" component="h1" fontWeight={700}>
						{translate("login.form.title")}
					</Typography>

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
									<InputAdornment position="start">
										<i className="fas fa-user" />
									</InputAdornment>
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
									<InputAdornment position="start">
										<i className="fas fa-lock" />
									</InputAdornment>
								),
								endAdornment: (
									<InputAdornment position="end">
										<TI
											className={eyeIconClass}
											title={showPassword ? "login.password.hide" : "login.password.show"}
											onClick={() => setShowPassword(prev => !prev)}
										/>
									</InputAdornment>
								)
							}
						}}
					/>

					<Stack direction="row" justifyContent="space-between" spacing={2}>
						<Link component={RouterLink} to="/lost-password" underline="hover" variant="body2">
							{translate("login.form.forgot-password")}
						</Link>
						<Link component={RouterLink} to="/register" underline="hover" variant="body2">
							{translate("login.form.register")}
						</Link>
					</Stack>

					{error && <Alert severity="error">{error}</Alert>}
					{message && <Alert severity="success">{message}</Alert>}

					<Button type="submit" variant="contained" disabled={loading} fullWidth size="large">
						{loading ? <CircularProgress size={22} color="inherit" /> : translate("login.form.submit")}
					</Button>
				</Stack>
			</Paper>
		</Box>
	)
}
