import { useEffect, useState } from "react"
import {
	Box,
	DialogActions,
	DialogContent,
	DialogTitle,
	Divider,
	Grid,
} from "@mui/material"
import { openAlert } from "components/AlertProvider/helper"
import { BotDifficultySlider } from "components/BotDifficulty/Slider"
import { ResponsiveDialog } from "components/ResponsiveDialog"
import { TButton, TTextField, TTypography } from "components/TranslationTag"
import { UserAvatarGroup } from "pages/Dashboard/components/UserAvatar"
import { getToken } from "common/helper"
import { useAPI } from "hooks/useAPI"
import { useRoomSettingsDialogContext } from "hooks/useAppContext"
import useToolkit from "hooks/useToolkit"
import useLayoutAuth from "pages/Dashboard/hook"
import { translate } from "locales/translate"
import { setRoomHostId } from "toolkit/slice/game"

const RoomSettingsDialog = () => {
	const {
		game,
		isHost,
		isOpen,
		room,
		users,

		closeSettings,
		handleSettingsSaved
	} = useRoomSettingsDialogContext()
	// Spectators are all users except the first 2 (players)
	const spectatorsUsers = users.filter(u => u.team === null)
	const { updateRoom } = useAPI()
	const { state, dispatch } = useToolkit()
	const { showProfilePopup } = useLayoutAuth()
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

	const handleDialogClose = (_: any, reason?: "backdropClick" | "escapeKeyDown") => {
		if (reason === "backdropClick") return
		closeSettings()
	}

	// Surface the room host to the profile popup so the host gets the kick action
	// when viewing a spectator's profile.
	const handleSpectatorClick = (userId: number) => {
		const activeElement = document.activeElement as HTMLElement | null
		activeElement?.blur()
		dispatch(setRoomHostId(room?.host_id ?? null))
		showProfilePopup(userId)
	}

	if (!room) return null

	return (
		<ResponsiveDialog
			drawerAnchor="bottom"
			open={isOpen}
			onClose={handleDialogClose}
			disableEnforceFocus
			sx={{ "& .MuiDialog-paper": { width: "calc(100% - 32px)", margin: 0 } }}
		>
			<DialogTitle>{translate("room.settings.title")}</DialogTitle>
			<Divider sx={{ borderColor: "primary.main" }} />
			<DialogContent className="pt-16 room-settings-dialog">
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
				{room.bet_amount > 0 && (
					<Grid className="room-bet-amount">
						<i className="fas fa-sack-dollar user-points" />
						{room.bet_amount.toLocaleString(state.lang)}
					</Grid>
				)}
				{!!room.time_limit && (
					<Grid className="room-time-limit">
						<i className="far fa-clock" />
						{translate("dashboard.popup.time-minutes").format(room.time_limit / 60)}
					</Grid>
				)}
				{!!room.time_increment && (
					<Grid className="room-time-limit">
						<i className="far fa-circle-plus" />
						{translate("dashboard.popup.time-increment")}:{" "}
						{translate("dashboard.popup.time-seconds").format(room.time_increment)}
					</Grid>
				)}
				{!!room.time_per_move && (
					<Grid className="room-time-limit">
						<i className="far fa-stopwatch" />
						{translate("dashboard.popup.time-per-move")}:{" "}
						{translate("dashboard.popup.time-seconds").format(room.time_per_move)}
					</Grid>
				)}
				{game && game.bot_difficulty !== null && (
					<Grid className="game-lelvel">
						<BotDifficultySlider level={game.bot_difficulty} disabled />
					</Grid>
				)}

				{spectatorsUsers.length > 0 && (
					<Box>
						<TTypography
							variant="subtitle2"
							className="joined-users"
							content="room.settings.players"
						/>
						<UserAvatarGroup
							users={spectatorsUsers}
							type="primary"
							maxVisible={7}
							onUserClick={handleSpectatorClick}
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
		</ResponsiveDialog>
	)
}

export default RoomSettingsDialog
