import { useState } from "react"
import classnames from "classnames"
import {
	Box,
	Button,
	CircularProgress,
	Link,
	Paper,
	Stack
} from "@mui/material"
import { Link as RouterLink, useNavigate } from "react-router-dom"
import { LOGIN_PATH } from "common/constant"
import Alert from "components/AlertWithIcon"
import { TI, TTextField, TTypography } from "components/TranslationTag"
import { ComboBoxWithLabel } from "components/ComboBoxWithLabel"
import { translate } from "locales/translate"
import useAutoTitle from "hooks/useAutoTitle"
import { useAPI } from "hooks/useAPI"
import { RegisterBodyType } from "./types"
import "./Register.scss"

const GENDER_OPTIONS = [
	{ key: "", value: "register.gender.select" },
	{ key: "male", value: "register.gender.male" },
	{ key: "female", value: "register.gender.female" }
]

const VALIDATION_RULES = {
	username: {
		pattern: /^[a-zA-Z0-9_.]+$/,
		message: "register.username.error1"
	},
	password: {
		minLength: 8,
		lowercase: /[a-z]/,
		uppercase: /[A-Z]/,
		numeric: /[0-9]/,
		special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/,
		message: "register.password.error1"
	},
	email: {
		pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
		message: "register.email.error1"
	}
}

const getPasswordPolicyStatus = (value: string) => ({
	hasLowercase: VALIDATION_RULES.password.lowercase.test(value),
	hasUppercase: VALIDATION_RULES.password.uppercase.test(value),
	hasMinLength: value.length >= VALIDATION_RULES.password.minLength,
	hasNumeric: VALIDATION_RULES.password.numeric.test(value),
	hasSpecial: VALIDATION_RULES.password.special.test(value)
})

export default function RegisterPage() {
	useAutoTitle(translate("register.page.title"))
	const [formData, setFormData] = useState({
		username: "",
		password: "",
		confirmPassword: "",
		gender: "",
		displayName: "",
		email: ""
	})

	const [errors, setErrors] = useState({
		username: undefined as string | undefined,
		password: undefined as string | undefined,
		confirmPassword: undefined as string | undefined,
		gender: undefined as string | undefined,
		displayName: undefined as string | undefined,
		email: undefined as string | undefined
	})

	const [showPassword, setShowPassword] = useState(false)
	const [showConfirmPassword, setShowConfirmPassword] = useState(false)
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [message, setMessage] = useState<string | null>(null)
	const navigate = useNavigate()
	const passwordPolicyStatus = getPasswordPolicyStatus(formData.password)
	const passwordPolicyItems = [
		{ key: "common.password.policy-1", matched: passwordPolicyStatus.hasLowercase },
		{ key: "common.password.policy-2", matched: passwordPolicyStatus.hasUppercase },
		{ key: "common.password.policy-3", matched: passwordPolicyStatus.hasNumeric },
		{ key: "common.password.policy-4", matched: passwordPolicyStatus.hasSpecial },
		{ key: "common.password.policy-5", matched: passwordPolicyStatus.hasMinLength },
	]

	const validateUsername = (value: string): boolean => {
		if (!value.trim()) {
			setErrors(prev => ({ ...prev, username: translate("common.input.is-required") }))
			return false
		}
		if (!VALIDATION_RULES.username.pattern.test(value)) {
			setErrors(prev => ({ ...prev, username: translate(VALIDATION_RULES.username.message) }))
			return false
		}
		setErrors(prev => ({ ...prev, username: undefined }))
		return true
	}

	const validatePassword = (value: string): boolean => {
		if (!value.trim()) {
			setErrors(prev => ({ ...prev, password: translate("common.input.is-required") }))
			return false
		}
		const policyStatus = getPasswordPolicyStatus(value)
		if (!Object.values(policyStatus).every(Boolean)) {
			setErrors(prev => ({ ...prev, password: translate(VALIDATION_RULES.password.message) }))
			return false
		}
		setErrors(prev => ({ ...prev, password: undefined }))
		return true
	}

	const validateConfirmPassword = (value: string): boolean => {
		if (!value.trim()) {
			setErrors(prev => ({ ...prev, confirmPassword: translate("common.input.is-required") }))
			return false
		}
		if (value !== formData.password) {
			setErrors(prev => ({ ...prev, confirmPassword: translate("register.confirm-password.error1") }))
			return false
		}
		setErrors(prev => ({ ...prev, confirmPassword: undefined }))
		return true
	}

	const validateEmail = (value: string): boolean => {
		if (!value.trim()) {
			setErrors(prev => ({ ...prev, email: translate("common.input.is-required") }))
			return false
		}
		if (!VALIDATION_RULES.email.pattern.test(value)) {
			setErrors(prev => ({ ...prev, email: translate(VALIDATION_RULES.email.message) }))
			return false
		}
		setErrors(prev => ({ ...prev, email: undefined }))
		return true
	}

	const validateGender = (value: string): boolean => {
		if (!value.trim()) {
			setErrors(prev => ({ ...prev, gender: translate("common.input.is-required") }))
			return false
		}
		setErrors(prev => ({ ...prev, gender: undefined }))
		return true
	}

	const validateDisplayName = (value: string): boolean => {
		if (!value.trim()) {
			setErrors(prev => ({ ...prev, displayName: translate("common.input.is-required") }))
			return false
		}
		setErrors(prev => ({ ...prev, displayName: undefined }))
		return true
	}

	const onChangeUsername = (event: React.ChangeEvent<HTMLInputElement>) => {
		const value = event.target.value
		setFormData(prev => ({ ...prev, username: value }))
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

	const onChangeEmail = (event: React.ChangeEvent<HTMLInputElement>) => {
		const value = event.target.value
		setFormData(prev => ({ ...prev, email: value }))
	}

	const onChangeGender = (event: any) => {
		const value = event.target.value
		setFormData(prev => ({ ...prev, gender: value }))
		validateGender(value)
	}

	const onChangeDisplayName = (event: React.ChangeEvent<HTMLInputElement>) => {
		const value = event.target.value
		setFormData(prev => ({ ...prev, displayName: value }))
	}

	const onBlurUsername = (event: React.FocusEvent<HTMLInputElement>) => {
		validateUsername(event.target.value)
	}

	const onBlurConfirmPassword = (event: React.FocusEvent<HTMLInputElement>) => {
		validateConfirmPassword(event.target.value)
	}

	const onBlurEmail = (event: React.FocusEvent<HTMLInputElement>) => {
		validateEmail(event.target.value)
	}

	const onBlurGender = (event: React.FocusEvent<HTMLInputElement>) => {
		validateGender(event.target.value)
	}

	const onBlurDisplayName = (event: React.FocusEvent<HTMLInputElement>) => {
		validateDisplayName(event.target.value)
	}

	const isFormValid = !errors.username
		&& !errors.password
		&& !errors.confirmPassword
		&& !errors.gender
		&& !errors.displayName
		&& !errors.email
		&& formData.username
		&& formData.password
		&& formData.confirmPassword
		&& formData.gender
		&& formData.displayName
		&& formData.email

	const { register } = useAPI()

	const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault()
		setError(null)
		setMessage(null)
		setLoading(true)

		// Validate all fields
		const isUsernameValid = validateUsername(formData.username)
		const isPasswordValid = validatePassword(formData.password)
		const isConfirmPasswordValid = validateConfirmPassword(formData.confirmPassword)
		const isGenderValid = validateGender(formData.gender)
		const isDisplayNameValid = validateDisplayName(formData.displayName)
		const isEmailValid = validateEmail(formData.email)

		if (!isUsernameValid
			|| !isPasswordValid
			|| !isConfirmPasswordValid
			|| !isGenderValid
			|| !isDisplayNameValid
			|| !isEmailValid
		) {
			setLoading(false)
			return
		}

		try {
			const registerData: RegisterBodyType = {
				username: formData.username,
				password: formData.password,
				email: formData.email,
				gender: formData.gender
			}
			const response = await register(registerData)
			
			if (response?.success) {
				setMessage(translate("register.form.success"))
				setTimeout(() => {
					navigate(LOGIN_PATH)
				}, 2000)
			} else {
				setLoading(false)
				const errorMsg = response?.message || translate("register.form.error1")
				setError(translate(errorMsg) === errorMsg ? errorMsg : translate(errorMsg))
			}
		} catch (submitError) {
			setLoading(false)
			const submitMessage = submitError instanceof Error
				? submitError.message
				: translate("register.form.error1")
			setError(submitMessage)
		}
	}

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
			<Paper elevation={4} sx={{ width: "calc(100% - 16px)", maxWidth: 500, p: 3, borderRadius: 3 }}>
				<Stack component="form" spacing={2} onSubmit={handleSubmit}>
					<TTypography
						variant="h5"
						component="h1"
						fontWeight={700}
						content="register.form.title"
					/>

					<TTextField
						label="register.username.label"
						placeholder="register.username.placeholder"
						variant="standard"
						name="username"
						autoFocus
						value={formData.username}
						onChange={onChangeUsername}
						onBlur={onBlurUsername}
						fullWidth
						error={!!errors.username}
						helperText={errors.username}
						slotProps={{
							input: {
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
										title={showConfirmPassword ? "register.confirm-password.hide" : "register.confirm-password.show"}
										onClick={() => setShowConfirmPassword(prev => !prev)}
									/>
								)
							}
						}}
					/>

					<ComboBoxWithLabel
						id="gender"
						title="register.gender.label"
						options={GENDER_OPTIONS}
						value={formData.gender}
						errorMessage={errors.gender}
						change={onChangeGender}
						blur={onBlurGender}
					/>

					<TTextField					label="register.display-name.label"
					placeholder="register.display-name.placeholder"
					variant="standard"
					name="displayName"
					value={formData.displayName}
					onChange={onChangeDisplayName}
					onBlur={onBlurDisplayName}
					fullWidth
					error={!!errors.displayName}
					helperText={errors.displayName}
					slotProps={{
						input: {
							startAdornment: (
								<i className="fas fa-tag start-icon" />
							)
						}
					}}
				/>

				<TTextField						label="register.email.label"
						placeholder="register.email.placeholder"
						variant="standard"
						name="email"
						type="email"
						value={formData.email}
						onChange={onChangeEmail}
						onBlur={onBlurEmail}
						fullWidth
						error={!!errors.email}
						helperText={errors.email}
						slotProps={{
							input: {
								startAdornment: (
									<i className="fas fa-envelope start-icon" />
								)
							}
						}}
					/>

					<Button type="submit" variant="contained" disabled={loading || !isFormValid} fullWidth size="large">
						{loading ? <CircularProgress size={22} color="inherit" /> : translate("register.form.submit")}
					</Button>

					{error && <Alert severity="error">{error}</Alert>}
					{message && <Alert severity="success">{message}</Alert>}

					<Stack direction="row" justifyContent="center" spacing={2}>
						<Link component={RouterLink} to={LOGIN_PATH} underline="hover" variant="body2">
							{translate("register.form.login")}
						</Link>
					</Stack>
				</Stack>
			</Paper>
		</Box>
	)
}
