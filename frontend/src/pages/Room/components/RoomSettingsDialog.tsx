import { useEffect, useState } from "react"
import {
	Box,
	Dialog,
	DialogActions,
	DialogContent,
	DialogTitle,
	Divider,
} from "@mui/material"
import { openAlert } from "components/AlertProvider"
import { Empty } from "components/Common"
import { PopupState } from "components/Layout/enums"
import { TButton, TTextField, TTypography } from "components/TranslationTag"
import { UserAvatarGroup } from "pages/Dashboard/components/UserAvatar"
import { getToken } from "common/helper"
import { useAPI } from "hooks/useAPI"
import { usePopups, useRoomSettingsDialogContext } from "hooks/useAppContext"
import useToolkit from "hooks/useToolkit"
import { translate } from "locales/translate"
import { setPopup } from "toolkit/slice/home"
import { UserAvatarType } from "types/Common"

const RoomSettingsDialog = () => {
	const {
    isHost,
    isOpen,
    room,
    users,

    closeSettings,
    handleSettingsSaved
  } = useRoomSettingsDialogContext()
	const { dispatch } = useToolkit()
	const { setProfileUser } = usePopups()
	// Spectators are all users except the first 2 (players)
	const spectatorsUsers = users?.slice(2) ?? []
	const spectatorsUsersMap: UserAvatarType[] = spectatorsUsers.map(user => user as UserAvatarType)
	const { getUserById, updateRoom } = useAPI()
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
					helperText={nameError ? "dashboard.popup.room-name-helptext" : undefined}
					fullWidth
					autoFocus={isHost}
					disabled={submitting || !isHost}
				/>

				{spectatorsUsers.length > 0 && (
					<Box className="mt-24">
						<TTypography
							variant="subtitle2"
							className="joined-users"
							content="room.settings.players"
						/>
						<UserAvatarGroup
							users={spectatorsUsersMap}
							type="primary"
							onUserClick={async (id) => {
								const userData = await getUserById(id)
								if (userData?.data) {
									setProfileUser(userData.data)
								}
								dispatch(setPopup(PopupState.PROFILE))
							}}
						/>
					</Box>
				)}
			</DialogContent>
			<Divider sx={{ borderColor: "primary.main" }} />
			<DialogActions className="pt-24 pb-16">
				{isHost && (
					<TButton
						variant="contained"
						onClick={handleSave}
						value="room.settings.save"
						disabled={submitting}
					/>
				)}
				<TButton
					variant="outlined"
					onClick={closeSettings}
					value="popup.confirm.cancel"
				/>
			</DialogActions>
		</Dialog>
	)
}

export default RoomSettingsDialog
