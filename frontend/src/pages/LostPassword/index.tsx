import { FormEvent, useState } from "react"
import { Link as RouterLink } from "react-router-dom"
import {
	Box,
	CircularProgress,
	Link,
	Paper,
	Stack
} from "@mui/material"
import { EMAIL_PATTERN, LOGIN_PATH } from "common/constant"
import Alert from "components/AlertWithIcon"
import { TButton, TTextField, TTypography } from "components/TranslationTag"
import useAutoTitle from "hooks/useAutoTitle"
import { useAPI } from "hooks/useAPI"
import { translate } from "locales/translate"
import "./LostPassword.scss"

export default function LostPasswordPage() {
	useAutoTitle(translate("forgot-password.page.title"))
	const [email, setEmail] = useState("")
	const [emailError, setEmailError] = useState<string | null>(null)
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [message, setMessage] = useState<string | null>(null)
	const { forgotPassword } = useAPI()

	const validateEmail = (value: string) => {
		if (!value.trim()) {
			setEmailError("common.input.is-required")
			return false
		}

		if (!EMAIL_PATTERN.test(value)) {
			setEmailError("register.email.error1")
			return false
		}

		setEmailError(null)
		return true
	}

	const onChangeEmail = (event: React.ChangeEvent<HTMLInputElement>) => {
		setEmail(event.target.value)
	}

	const onBlurEmail = (event: React.FocusEvent<HTMLInputElement>) => {
		validateEmail(event.target.value)
	}

	const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		setError(null)
		setMessage(null)
		setLoading(true)

		if (!validateEmail(email)) {
			setLoading(false)
			return
		}

		try {
			const response = await forgotPassword({ email })

			if (!response?.success) {
				const responseMessage = response?.message || "forgot-password.form.error1"
				setMessage(responseMessage)
				setLoading(false)
				return
			}

			const responseMessage = response?.message || "forgot-password.form.success"
			setMessage(responseMessage)
		} catch (submitError) {
			const submitMessage = submitError instanceof Error
				? submitError.message
				: translate("forgot-password.form.error1")
			setError(submitMessage)
		} finally {
			setLoading(false)
		}
	}

	return (
		<Box className="unauth-form-container">
			<Paper elevation={4} className="unauth-form-paper-container">
				<Stack component="form" spacing={2} onSubmit={onSubmit}>
					<TTypography
						variant="h5"
						component="h1"
						sx={{ fontWeight: 700 }}
						content="forgot-password.form.title"
					/>

					<TTextField
						label="register.email.label"
						placeholder="register.email.placeholder"
						variant="standard"
						name="email"
						type="email"
						autoFocus
						required
						value={email}
						onChange={onChangeEmail}
						onBlur={onBlurEmail}
						fullWidth
						error={!!emailError}
						helperText={emailError}
						slotProps={{
							input: {
								startAdornment: (
									<i className="fas fa-envelope start-icon" />
								)
							}
						}}
					/>

					<TButton
						type="submit"
						variant="contained"
						disabled={loading}
						fullWidth
						size="large"
						value="forgot-password.form.submit"
						startIcon={loading ? <CircularProgress size={22} color="inherit" /> : null}
					/>

					{error && <Alert severity="error">{error}</Alert>}
					{message && <Alert severity="success">{message}</Alert>}

					<Link component={RouterLink} to={LOGIN_PATH} underline="hover" variant="body2">
						{translate("forgot-password.form.login")}
					</Link>
				</Stack>
			</Paper>
		</Box>
	)
}
