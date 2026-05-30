import { useEffect, useState } from "react"
import {
	Dialog,
	DialogActions,
	DialogContent,
	DialogTitle,
	Divider
} from "@mui/material"
import { openAlert } from "components/AlertProvider"
import { Empty } from "components/Common"
import { TButton, TTextField } from "components/TranslationTag"
import { getToken } from "common/helper"
import { useAPI } from "hooks/useAPI"
import { useRoomSettingsDialogContext } from "hooks/useAppContext"
import { translate } from "locales/translate"

const RoomSettingsDialog = () => {
	const {
    isOpen,
    room,

    closeSettings,
    handleSettingsSaved
  } = useRoomSettingsDialogContext()
	const { updateRoom } = useAPI()
	const [name, setName] = useState(room?.name ?? "")
	const [nameError, setNameError] = useState(false)
	const [submitting, setSubmitting] = useState(false)

	useEffect(() => {
		if (isOpen && room) {
			setName(room.name)
			setNameError(false)
			setSubmitting(false)
		}
	}, [isOpen, room])

	const handleSave = async () => {
		if (name.trim().length === 0) {
			setNameError(true)
			return
		}
		if (submitting) return

		setSubmitting(true)
		const token = getToken()
		const response = await updateRoom(token, room!.id, name.trim())
		setSubmitting(false)

		if (!response?.success) {
			await openAlert({
				title: "popup.alert.title",
				message: response?.message ?? "update-room.messages.internal-server-error"
			})
			return
		}

		handleSettingsSaved(name.trim())
		closeSettings()
	}

	const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		setName(e.target.value)
		if (nameError && e.target.value.trim().length > 0) {
			setNameError(false)
		}
	}

  if (!room) return <Empty />

	return (
		<Dialog open={isOpen} onClose={closeSettings} fullWidth maxWidth="xs">
			<DialogTitle>{translate("room.settings.title")}</DialogTitle>
			<Divider sx={{ borderColor: "primary.main" }} />
			<DialogContent className="pt-16">
				<TTextField
					label="room.settings.room-name"
					value={name}
          variant="standard"
					onChange={handleNameChange}
					onBlur={() => setNameError(name.trim().length === 0)}
					error={nameError}
					helperText={nameError ? translate("dashboard.popup.room-name-helptext") : undefined}
					fullWidth
					autoFocus
					disabled={submitting}
				/>
			</DialogContent>
			<Divider sx={{ borderColor: "primary.main" }} />
			<DialogActions className="pt-24 pb-16">
				<TButton
					variant="contained"
					onClick={handleSave}
					value="room.settings.save"
					disabled={submitting}
				/>
				<TButton onClick={closeSettings} value="popup.confirm.cancel" />
			</DialogActions>
		</Dialog>
	)
}

export default RoomSettingsDialog
