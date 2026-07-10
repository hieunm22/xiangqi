import { useEffect, useState } from "react"
import { useSearchParams, useNavigate } from "react-router-dom"
import classnames from "classnames"
import {
	Box,
	CircularProgress,
	Paper,
	Stack
} from "@mui/material"
import { LOGIN_PATH } from "common/constant"
import Alert from "components/AlertWithIcon"
import MessageScreen from "components/MessageScreen"
import { TButton, TI, TTextField, TTypography } from "components/TranslationTag"
import { translate } from "locales/translate"
import useAutoTitle from "hooks/useAutoTitle"
import { useAPI } from "hooks/useAPI"
import { ResetPasswordBodyType } from "./types"
import "./ResetPassword.scss"

const VALIDATION_RULES = {
	password: {
		minLength: 8,
		lowercase: /[a-z]/,
		uppercase: /[A-Z]/,
		numeric: /[0-9]/,
		special: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/,
		message: "register.password.error1"
	}
}

const getPasswordPolicyStatus = (value: string) => ({
	hasLowercase: VALIDATION_RULES.password.lowercase.test(value),
	hasUppercase: VALIDATION_RULES.password.uppercase.test(value),
	hasMinLength: value.length >= VALIDATION_RULES.password.minLength,
	hasNumeric: VALIDATION_RULES.password.numeric.test(value),
	hasSpecial: VALIDATION_RULES.password.special.test(value)
})

export default function ResetPasswordPage() {
	useAutoTitle(translate("reset-password.page.title"))
	const [searchParams] = useSearchParams()
	const navigate = useNavigate()
	const { resetPasswordValidate, resetPassword } = useAPI()

	const [formData, setFormData] = useState({
		password: "",
		confirmPassword: ""
	})

	const [errors, setErrors] = useState({
		password: undefined as string | undefined,
		confirmPassword: undefined as string | undefined
	})

	const [showPassword, setShowPassword] = useState(false)
	const [showConfirmPassword, setShowConfirmPassword] = useState(false)
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [message, setMessage] = useState<string | null>(null)
	const [validating, setValidating] = useState(true)
	const [isValidToken, setIsValidToken] = useState(false)
	const [userId, setUserId] = useState<number | null>(null)
	const [userName, setUserName] = useState("")

	const passwordPolicyStatus = getPasswordPolicyStatus(formData.password)
	const passwordPolicyItems = [
		{ key: "common.password.policy-1", matched: passwordPolicyStatus.hasLowercase },
		{ key: "common.password.policy-2", matched: passwordPolicyStatus.hasUppercase },
		{ key: "common.password.policy-3", matched: passwordPolicyStatus.hasNumeric },
		{ key: "common.password.policy-4", matched: passwordPolicyStatus.hasSpecial },
		{ key: "common.password.policy-5", matched: passwordPolicyStatus.hasMinLength },
	]

	const validatePassword = (value: string): boolean => {
		if (!value.trim()) {
			setErrors(prev => ({ ...prev, password: "common.input.is-required" }))
			return false
		}
		const policyStatus = getPasswordPolicyStatus(value)
		if (!Object.values(policyStatus).every(Boolean)) {
			setErrors(prev => ({ ...prev, password: VALIDATION_RULES.password.message }))
			return false
		}
		setErrors(prev => ({ ...prev, password: undefined }))
		return true
	}

	const validateConfirmPassword = (value: string): boolean => {
		if (!value.trim()) {
			setErrors(prev => ({ ...prev, confirmPassword: "common.input.is-required" }))
			return false
		}
		if (value !== formData.password) {
			setErrors(prev => ({ ...prev, confirmPassword: "register.confirm-password.error1" }))
			return false
		}
		setErrors(prev => ({ ...prev, confirmPassword: undefined }))
		return true
	}

	const onChangePassword = (event: React.ChangeEvent<HTMLInputElement>) => {
		const value = event.target.value
		setFormData(prev => ({ ...prev, password: value }))
		validatePassword(value)
	}

	const onChangeConfirmPassword = (event: React.ChangeEvent<HTMLInputElement>) => {
		const value = event.target.value
		setFormData(prev => ({ ...prev, confirmPassword: value }))
	}

	const onBlurConfirmPassword = (event: React.FocusEvent<HTMLInputElement>) => {
		validateConfirmPassword(event.target.value)
	}

	const isFormValid = !errors.password
		&& !errors.confirmPassword
		&& formData.password
		&& formData.confirmPassword

	const eyeIconClass = classnames("show-password fas", {
		"fa-eye": !showPassword,
		"fa-eye-slash": showPassword
	})

	const eyeIconClassConfirm = classnames("show-password fas", {
		"fa-eye": !showConfirmPassword,
		"fa-eye-slash": showConfirmPassword
	})

	const passwordPolicyHelperText = (
		<Stack spacing={0.5} className="password-policy-helper">
			{passwordPolicyItems.map(item => (
				<div
					key={item.key}
					className={classnames("password-policy-line", {
						matched: item.matched
					})}
				>
					<i
						className={classnames("fas password-policy-icon", {
							"fa-times": !item.matched,
							"fa-check": item.matched
						})}
					/>
					<span>{translate(item.key)}</span>
				</div>
			))}
		</Stack>
	)

	// Validate token on component mount
	useEffect(() => {
		const validateToken = async () => {
			try {
				const id = searchParams.get("id")
				const token = searchParams.get("token")

				if (!id || !token) {
					setIsValidToken(false)
					setValidating(false)
					return
				}

				const response = await resetPasswordValidate(Number(id), token)

				if (response?.success && response?.data) {
					setIsValidToken(true)
					setUserId(Number(response.data.id))
					setUserName(response.data.user_name)
				} else {
					setIsValidToken(false)
				}
			} catch {
				setIsValidToken(false)
			} finally {
				setValidating(false)
			}
		}

		validateToken()
	}, [])

	const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault()
		setError(null)
		setMessage(null)
		setLoading(true)

		// Validate all fields
		const isPasswordValid = validatePassword(formData.password)
		const isConfirmPasswordValid = validateConfirmPassword(formData.confirmPassword)

		if (!isPasswordValid || !isConfirmPasswordValid) {
			setLoading(false)
			return
		}

		if (!userId) {
			setError("reset-password.form.error1")
			setLoading(false)
			return
		}

		try {
			const resetData: ResetPasswordBodyType = {
				userId,
				password: formData.password
			}
			const response = await resetPassword(resetData)

			if (response?.success) {
				setMessage(translate("reset-password.form.success"))
				setTimeout(() => {
					navigate(LOGIN_PATH)
				}, 2000)
			} else {
				setLoading(false)
				const errorMsg = response?.message || translate("reset-password.form.error1")
				setError(translate(errorMsg) === errorMsg ? errorMsg : translate(errorMsg))
			}
		} catch (submitError) {
			setLoading(false)
			const submitMessage = submitError instanceof Error
				? submitError.message
				: translate("reset-password.form.error1")
			setError(submitMessage)
		}
	}

	if (validating) {
		return (
			<Box className="unauth-form-container">
				<CircularProgress />
			</Box>
		)
	}

	if (!isValidToken) {
		return <MessageScreen
			message="reset-password.form.invalid-token"
			icon="fa-circle-exclamation fail"
		/>
	}

	return (
		<Box className="unauth-form-container">
			<Paper elevation={4} className="unauth-form-paper-container">
				<Stack component="form" spacing={2} onSubmit={handleSubmit}>
					<TTypography
						variant="h5"
						component="h1"
						className="bold"
						content="reset-password.form.title"
					/>

					<TTextField
						label="login.username.label"
						variant="standard"
						name="username"
						disabled
						value={userName}
						fullWidth
						slotProps={{
							input: {
								readOnly: true,
								startAdornment: (
									<i className="fas fa-user start-icon" />
								)
							}
						}}
					/>

					<TTextField
						label="register.password.label"
						placeholder="register.password.placeholder"
						variant="standard"
						name="password"
						type={showPassword ? "text" : "password"}
						autoFocus
						value={formData.password}
						onChange={onChangePassword}
						fullWidth
						error={!!errors.password}
						helperText={passwordPolicyHelperText}
						slotProps={{
							input: {
								startAdornment: (
									<i className="fas fa-lock start-icon" />
								),
								endAdornment: (
									<TI
										className={eyeIconClass}
										title={showPassword ? "register.password.hide" : "register.password.show"}
										onClick={() => setShowPassword(prev => !prev)}
									/>
								)
							}
						}}
					/>

					<TTextField
						label="register.confirm-password.label"
						placeholder="register.confirm-password.placeholder"
						variant="standard"
						name="confirmPassword"
						type={showConfirmPassword ? "text" : "password"}
						value={formData.confirmPassword}
						onChange={onChangeConfirmPassword}
						onBlur={onBlurConfirmPassword}
						fullWidth
						error={!!errors.confirmPassword}
						helperText={errors.confirmPassword}
						slotProps={{
							input: {
								startAdornment: (
									<i className="fas fa-lock start-icon" />
								),
								endAdornment: (
									<TI
										className={eyeIconClassConfirm}
										title={showConfirmPassword
											? "register.confirm-password.hide"
											: "register.confirm-password.show"
										}
										onClick={() => setShowConfirmPassword(prev => !prev)}
									/>
								)
							}
						}}
					/>

					<TButton
						type="submit"
						variant="contained"
						disabled={loading || !isFormValid}
						fullWidth
						size="large"
						value="reset-password.form.submit"
						startIcon={loading ? <CircularProgress size={22} color="inherit" /> : null}
					/>

					{error && <Alert severity="error">{error}</Alert>}
					{message && <Alert severity="success">{message}</Alert>}
				</Stack>
			</Paper>
		</Box>
	)
}
