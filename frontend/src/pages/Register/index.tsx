import { ChangeEvent, FocusEvent, SubmitEvent, useState } from "react"
import { Link as RouterLink, useNavigate } from "react-router-dom"
import classnames from "classnames"
import {
	Box,
	CircularProgress,
	Link,
	Paper,
	Stack
} from "@mui/material"
import { EMAIL_PATTERN, LOGIN_PATH } from "common/constant"
import { isPasswordPolicyMet } from "common/password"
import { GENDER_OPTIONS, VALIDATION_RULES } from "./constants"
import Alert from "components/AlertWithIcon"
import { ComboBoxWithLabel } from "components/ComboBoxWithLabel"
import { PasswordPolicyChecklist } from "components/PasswordPolicyChecklist"
import { TButton, TI, TTextField, TTypography } from "components/TranslationTag"
import useAutoTitle from "hooks/useAutoTitle"
import { useAPI } from "hooks/useAPI"
import { translate } from "locales/translate"
import { RegisterBodyType } from "./types"
import "./Register.scss"

export default function RegisterPage() {
	useAutoTitle(translate("register.page.title"))
	const [formData, setFormData] = useState<RegisterBodyType>({
		username: "",
		password: "",
		confirmPassword: "",
		gender: "",
		displayName: "",
		email: ""
	})

	const [errors, setErrors] = useState<Partial<RegisterBodyType>>({
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

	const validateEmail = (value: string) => {
		if (!value.trim()) {
			setErrors(prev => ({ ...prev, email: "common.input.is-required" }))
			return false
		}

		if (!EMAIL_PATTERN.test(value)) {
			setErrors(prev => ({ ...prev, email: "register.email.error1" }))
			return false
		}

		return true
	}

	const validateFieldWithPattern = (fieldName: keyof typeof formData, value: string): boolean => {
		if (!value.trim()) {
			setErrors(prev => ({ ...prev, [fieldName]: "common.input.is-required" }))
			return false
		}
		if (fieldName === "username" && !VALIDATION_RULES[fieldName].pattern.test(value)) {
			setErrors(prev => ({ ...prev, [fieldName]: VALIDATION_RULES[fieldName].message }))
			return false
		}
		if (fieldName === "email") {
			return validateEmail(value)
		}
		setErrors(prev => ({ ...prev, [fieldName]: undefined }))
		return true
	}

	const validatePassword = (value: string): boolean => {
		if (!value.trim()) {
			setErrors(prev => ({ ...prev, password: "common.input.is-required" }))
			return false
		}
		if (!isPasswordPolicyMet(value)) {
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

	const validateRequiredField = (fieldName: keyof typeof formData, value: string): boolean => {
		if (!value.trim()) {
			setErrors(prev => ({ ...prev, [fieldName]: "common.input.is-required" }))
			return false
		}
		setErrors(prev => ({ ...prev, [fieldName]: undefined }))
		return true
	}

	const onChangeField = (field: keyof typeof formData) => (e: ChangeEvent<HTMLInputElement>) => {
		const value = e.target.value
		setFormData(prev => ({ ...prev, [field]: value }))
	}

	const onChangePassword = (event: ChangeEvent<HTMLInputElement>) => {
		const value = event.target.value
		setFormData(prev => ({ ...prev, password: value }))
		validatePassword(value)
	}

	const onChangeGender = (event: any) => {
		const value = event.target.value
		setFormData(prev => ({ ...prev, gender: value }))
		validateRequiredField("gender", value)
	}

	const onBlurUsername = (event: FocusEvent<HTMLInputElement>) => {
		validateFieldWithPattern("username", event.target.value)
	}

	const onBlurConfirmPassword = (event: FocusEvent<HTMLInputElement>) => {
		validateConfirmPassword(event.target.value)
	}

	const onBlurEmail = (event: FocusEvent<HTMLInputElement>) => {
		validateFieldWithPattern("email", event.target.value)
	}

	const onBlurGender = (event: FocusEvent<HTMLInputElement>) => {
		validateRequiredField("gender", event.target.value)
	}

	const onBlurDisplayName = (event: FocusEvent<HTMLInputElement>) => {
		validateRequiredField("displayName", event.target.value)
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

	const handleSubmit = async (e: SubmitEvent<HTMLFormElement>) => {
		e.preventDefault()
		setError(null)
		setMessage(null)
		setLoading(true)

		// Validate all fields
		const isUsernameValid = validateFieldWithPattern("username", formData.username)
		const isPasswordValid = validatePassword(formData.password)
		const isConfirmPasswordValid = validateConfirmPassword(formData.confirmPassword)
		const isGenderValid = validateRequiredField("gender", formData.gender)
		const isDisplayNameValid = validateRequiredField("displayName", formData.displayName)
		const isEmailValid = validateFieldWithPattern("email", formData.email)

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
				confirmPassword: formData.confirmPassword,
				gender: formData.gender,
				displayName: formData.displayName,
				email: formData.email
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
				setError(translate(errorMsg) === errorMsg ? errorMsg : (errorMsg))
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

	const passwordPolicyHelperText = <PasswordPolicyChecklist value={formData.password} />

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
			<Paper elevation={4} className="unauth-form-paper-container">
				<Stack component="form" spacing={2} onSubmit={handleSubmit}>
					<TTypography
						variant="h5"
						component="h1"
						sx={{ fontWeight: 700 }}
						content="register.form.title"
					/>

					<TTextField
						label="register.username.label"
						placeholder="register.username.placeholder"
						variant="standard"
						name="username"
						autoFocus
						value={formData.username}
						onChange={onChangeField("username")}
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
						onChange={onChangeField("confirmPassword")}
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
											: "register.confirm-password.show"}
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
						errorMessage={translate(errors.gender)}
						change={onChangeGender}
						blur={onBlurGender}
					/>

					<TTextField
						label="register.display-name.label"
						placeholder="register.display-name.placeholder"
						variant="standard"
						name="displayName"
						value={formData.displayName}
						onChange={onChangeField("displayName")}
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

					<TTextField
						label="register.email.label"
						placeholder="register.email.placeholder"
						variant="standard"
						name="email"
						type="email"
						value={formData.email}
						onChange={onChangeField("email")}
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

					<TButton
						type="submit"
						variant="contained"
						disabled={loading || !isFormValid}
						fullWidth
						size="large"
						value="register.form.submit"
						startIcon={loading ? <CircularProgress size={22} color="inherit" /> : undefined}
					/>

					{error && <Alert severity="error">{error}</Alert>}
					{message && <Alert severity="success">{message}</Alert>}

					<Stack direction="row" spacing={2} sx={{ justifyContent: "center" }}>
						<Link component={RouterLink} to={LOGIN_PATH} underline="hover" variant="body2">
							{translate("register.form.login")}
						</Link>
					</Stack>
				</Stack>
			</Paper>
		</Box>
	)
}
