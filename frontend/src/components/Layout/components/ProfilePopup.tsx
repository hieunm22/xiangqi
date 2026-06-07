import { useEffect, useState } from "react"
import {
	Box,
	Dialog,
	DialogContent,
	DialogTitle,
	Divider,
	Grid
} from "@mui/material"
import { PopupState } from "../enums"
import { openAlert } from "components/AlertProvider"
import { TButton, TSpan, TTooltip } from "components/TranslationTag"
import { getClaimsFromLocalStorage, getToken } from "common/helper"
import { usePopups } from "hooks/useAppContext"
import { useAPI } from "hooks/useAPI"
import useToolkit from "hooks/useToolkit"
import { translate } from "locales/translate"
import { RoomInfo } from "pages/Room/types"
import { setGameHistoryUserId, setPopup } from "toolkit/slice/home"

export const ProfilePopup = () => {
	const { profileUser: user } = usePopups()
	const { state, dispatch } = useToolkit()
	const { getRoomById, kickUser } = useAPI()
	const [isRoomHost, setIsRoomHost] = useState(false)
	const [room, setRoom] = useState<RoomInfo | null>(null)

	const handleCloseProfilePopup = () => {
		dispatch(setPopup(PopupState.NONE))
	}

	const handleChangePassword = () => {
		// TODO: open change password dialog
	}

	const claims = getClaimsFromLocalStorage()
	const currentUserId = Number(claims?.sub)
	const normalizedCurrentUserId = currentUserId ?? null
	const isOwnProfile = user?.id === normalizedCurrentUserId

	useEffect(() => {
		const loadRoomContext = async () => {
			if (state.popupState !== PopupState.PROFILE || isOwnProfile) {
				setIsRoomHost(false)
				return
			}

			const roomIdMatch = location.pathname.match(/^\/room\/(\d+)$/)
			if (!roomIdMatch) {
				setIsRoomHost(false)
				return
			}

			const roomId = Number(roomIdMatch[1])
			const token = getToken()
			if (!token || !Number.isInteger(roomId) || roomId <= 0) {
				setIsRoomHost(false)
				return
			}

			const roomResponse = await getRoomById(token, roomId)
			if (!roomResponse?.success || !roomResponse.data) {
				setIsRoomHost(false)
				return
			}

			setRoom(roomResponse?.data.room || null)

			const hostId = roomResponse.data.users?.[0]?.id
			setIsRoomHost(hostId === normalizedCurrentUserId)
		}

		if (state.popupState !== PopupState.PROFILE) {
			return
		}

		loadRoomContext()
	}, [state.popupState])

	const handleViewHistory = () => {
		dispatch(setGameHistoryUserId(user!.id))
		dispatch(setPopup(PopupState.GAME_HISTORY))
	}

	const handleKickUser = async () => {
		if (!user) {
			return
		}

		const roomIdMatch = location.pathname.match(/^\/room\/(\d+)$/)
		if (!roomIdMatch) {
			return
		}

		const roomId = Number(roomIdMatch[1])
		const token = getToken()
		if (!token || !Number.isInteger(roomId) || roomId <= 0) {
			return
		}

		const response = await kickUser(token, roomId, user.id)
		if (!response || !response.success) {
			await openAlert({
				title: "popup.alert.title",
				message: response?.message ?? "kick-user.messages.internal-server-error"
			})
			return
		}

		// The kicked user is removed from everyone's seat list via the
		// `room-users-updated` socket broadcast, so the host just closes the popup.
		dispatch(setPopup(PopupState.NONE))
	}

	return (
		<Dialog
			open={state.popupState === PopupState.PROFILE}
			onClose={handleCloseProfilePopup}
			maxWidth="xs"
			fullWidth
			disableRestoreFocus
		>
			<DialogTitle className="pt-8 pb-8">{translate("menu.profile")}</DialogTitle>
			<Divider sx={{ borderColor: "primary.main" }} />
			<DialogContent>
				{user && (
					<Box className="profile-user-info">
						<TTooltip title="register.username.label" arrow placement="left">
							<i className="far fa-user mr-20" />
						</TTooltip>
						<a href={`https://facebook.com/${user.user_name}`} target="_blank" rel="noopener noreferrer">
							{user.user_name}
						</a>
						<TTooltip title="register.display-name.label" arrow placement="left">
							<i className="far fa-tag" />
						</TTooltip>
						<span>{user.display_name || "-"}</span>
						<TTooltip title="register.gender.label" arrow placement="left">
							<i className="far fa-venus-mars" />
						</TTooltip>
						<TSpan content={user.gender ? "register.gender.male" : "register.gender.female"} />
						<TTooltip title="register.email.label" arrow placement="left">
							<i className="far fa-envelope" />
						</TTooltip>
						<a href={`mailto:${user.email}`}>{user.email}</a>
					</Box>
				)}
			</DialogContent>
			<Divider sx={{ borderColor: "primary.main" }} />
			<Grid container className="profile-dialog-actions">
				{user && (
					<TButton
						variant="contained"
						size="small"
						color="success"
						onClick={handleViewHistory}
						value="page.history.title"
					/>
				)}
				{user && !isOwnProfile && isRoomHost && (
					<TButton
						variant="contained"
						size="small"
						color="warning"
						disabled={!room || room.status === 2} // Only allow kicking when the room is in "waiting" status
						onClick={handleKickUser}
						value="room.actions.kick"
					/>
				)}
				{isOwnProfile && (
					<TButton
						variant="contained"
						size="small"
						onClick={handleChangePassword}
						value="settings.change-password"
					/>
				)}
				<TButton
					variant="outlined"
					size="medium"
					onClick={handleCloseProfilePopup}
					value="settings.close"
				/>
			</Grid>
		</Dialog>
	)
}
