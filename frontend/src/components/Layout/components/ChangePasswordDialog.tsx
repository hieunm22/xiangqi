import { useEffect, useState } from "react"
import classnames from "classnames"
import {
	DialogContent,
	DialogTitle,
	Divider,
	Grid,
	Stack
} from "@mui/material"
import { PopupState } from "common/enums"
import { ResponsiveDialog } from "components/ResponsiveDialog"
import { getToken } from "common/helper"
import { isPasswordPolicyMet } from "common/password"
import { openSnackbar } from "components/SnackbarProvider/helper"
import { PasswordPolicyChecklist } from "components/PasswordPolicyChecklist"
import { TButton, TI, TTextField, TTypography } from "components/TranslationTag"
import { useAPI } from "hooks/useAPI"
import useToolkit from "hooks/useToolkit"
import { translate } from "locales/translate"
import { setPopup } from "toolkit/slice/game"
import { APIResponseEmpty } from "types/Common"

const EMPTY_FORM = {
	currentPassword: "",
	newPassword: "",
	confirmPassword: ""
}

export const ChangePasswordDialog = () => {
	const { gameState, dispatch } = useToolkit()
	const { changePassword } = useAPI()

	const [form, setForm] = useState(EMPTY_FORM)
	const [showCurrent, setShowCurrent] = useState(false)
	const [showNew, setShowNew] = useState(false)
	const [showConfirm, setShowConfirm] = useState(false)
	const [loading, setLoading] = useState(false)
	const [serverError, setServerError] = useState<string | null>(null)

	const isOpen = gameState.popupState === PopupState.CHANGE_PASSWORD

	// Never keep sensitive input around once the dialog is dismissed.
	useEffect(() => {
		if (!isOpen) {
			setForm(EMPTY_FORM)
			setShowCurrent(false)
			setShowNew(false)
			setShowConfirm(false)
			setLoading(false)
			setServerError(null)
		}
	}, [isOpen])

	const onChange = (field: keyof typeof form) => (event: { target: { value: string } }) => {
		const { value } = event.target
		setForm(prev => ({ ...prev, [field]: value }))
		setServerError(null)
	}

	const isPolicyMet = isPasswordPolicyMet(form.newPassword)
	const { confirmPassword, newPassword } = form
	const isConfirmMismatch = confirmPassword.length > 0 && confirmPassword !== newPassword
	const canSubmit =
		form.currentPassword.length > 0
		&& isPolicyMet
		&& form.confirmPassword === form.newPassword
		&& !loading

	const closeDialog = () => dispatch(setPopup(PopupState.NONE))

	const handleClose = (_: unknown, reason: "backdropClick" | "escapeKeyDown") => {
		if (reason === "backdropClick") return
		closeDialog()
	}

	const handleSubmit = async () => {
		if (!canSubmit) return

		const token = getToken()
		if (!token) {
			setServerError("change-password.messages.unauthorized")
			return
		}

		setLoading(true)
		setServerError(null)
		const response = await changePassword(token, {
			currentPassword: form.currentPassword,
			newPassword: form.newPassword
		}) as APIResponseEmpty | undefined

		setLoading(false)

		if (!response?.success) {
			setServerError(response?.message ?? "change-password.messages.internal-server-error")
			return
		}

		openSnackbar({
			avatar: null,
			message: translate("change-password.messages.success"),
			severity: "success",
			duration: 3000
		})
		closeDialog()
	}

	const eyeClass = (shown: boolean) => classnames("show-password fas", {
		"fa-eye": !shown,
		"fa-eye-slash": shown
	})
	
	const changePasswordIcon = loading
		? <i className="fas fa-spinner fa-pulse" />
		: <i className="fas fa-key" />
	const changePasswordLabel = loading
		? "change-password.submitting"
		: "change-password.submit"

	const eyeAdornment = (shown: boolean, toggle: () => void) => (
		<TI
			className={eyeClass(shown)}
			title={shown ? "change-password.hide" : "change-password.show"}
			onClick={toggle}
		/>
	)

	return (
		<ResponsiveDialog
			drawerAnchor="top"
			open={isOpen}
			onClose={handleClose}
			className="change-password-dialog"
			fullWidth
			maxWidth="xs"
		>
			<DialogTitle className="popup-title">
				<TTypography content="change-password.title" />
			</DialogTitle>
			<Divider sx={{ borderColor: "primary.main" }} />
			<DialogContent>
				<Stack component="form" spacing={2} sx={{ mt: 1 }}>
					<TTextField
						label="change-password.current.label"
						placeholder="change-password.current.placeholder"
						variant="standard"
						name="currentPassword"
						type={showCurrent ? "text" : "password"}
						value={form.currentPassword}
						onChange={onChange("currentPassword")}
						fullWidth
						slotProps={{
							input: {
								startAdornment: <i className="fas fa-lock start-icon" />,
								endAdornment: eyeAdornment(showCurrent, () => setShowCurrent(prev => !prev))
							}
						}}
					/>

					<TTextField
						label="change-password.new.label"
						placeholder="change-password.new.placeholder"
						variant="standard"
						name="newPassword"
						type={showNew ? "text" : "password"}
						value={form.newPassword}
						onChange={onChange("newPassword")}
						fullWidth
						helperText={<PasswordPolicyChecklist value={form.newPassword} />}
						slotProps={{
							input: {
								startAdornment: <i className="fas fa-lock start-icon" />,
								endAdornment: eyeAdornment(showNew, () => setShowNew(prev => !prev))
							}
						}}
					/>

					<TTextField
						label="change-password.confirm.label"
						placeholder="change-password.confirm.placeholder"
						variant="standard"
						name="confirmPassword"
						type={showConfirm ? "text" : "password"}
						value={form.confirmPassword}
						onChange={onChange("confirmPassword")}
						fullWidth
						error={isConfirmMismatch}
						helperText={isConfirmMismatch ? "change-password.confirm.mismatch" : undefined}
						slotProps={{
							input: {
								startAdornment: <i className="fas fa-lock start-icon" />,
								endAdornment: eyeAdornment(showConfirm, () => setShowConfirm(prev => !prev))
							}
						}}
					/>

					{serverError && (
						<TTypography className="change-password-error" color="error" content={serverError} />
					)}
				</Stack>
			</DialogContent>
			<Divider sx={{ borderColor: "primary.main" }} />
			<Grid container className="change-password-actions">
				<TButton
					variant="contained"
					size="small"
					color="primary"
					disabled={!canSubmit}
					onClick={handleSubmit}
					className="fit-content"
					value={changePasswordLabel}
					startIcon={changePasswordIcon}
				/>
				<TButton
					variant="outlined"
					size="small"
					onClick={closeDialog}
					className="fit-content"
					value="settings.close"
					startIcon={<i className="fas fa-xmark" />}
				/>
			</Grid>
		</ResponsiveDialog>
	)
}
