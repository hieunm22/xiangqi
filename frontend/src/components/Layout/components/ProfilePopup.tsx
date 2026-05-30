import { useEffect, useState } from "react"
import {
	Box,
	Dialog,
	DialogContent,
	DialogTitle,
	Divider,
	Grid
} from "@mui/material"
import { TButton, TSpan, TTooltip } from "components/TranslationTag"
import { getClaimsFromLocalStorage, getToken } from "common/helper"
import { usePopups } from "hooks/useAppContext"
import { useAPI } from "hooks/useAPI"
import { translate } from "locales/translate"
import { RoomInfo } from "pages/Room/types"

export const ProfilePopup = () => {
	const { openProfilePopup, setOpenProfilePopup, profileUser: user } = usePopups()
	const { getRoomById } = useAPI()
	const [isRoomHost, setIsRoomHost] = useState(false)
	const [room, setRoom] = useState<RoomInfo | null>(null)
	const [game, setGame] = useState<RoomInfo | null>(null)

	const handleCloseProfilePopup = () => {
		setOpenProfilePopup(false)
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
			if (!openProfilePopup || isOwnProfile) {
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
			setGame(roomResponse?.data.game || null)

			const hostId = roomResponse.data.users?.[0]?.id
			setIsRoomHost(hostId === normalizedCurrentUserId)
		}

		if (!openProfilePopup) {
			return
		}

		loadRoomContext()
	}, [openProfilePopup])

	const handleViewHistory = () => {
		// TODO: open player history page/filter by selected user id.
		console.info("TODO: view history for user", user?.id)
	}

	const handleKickUser = () => {
		// TODO: add kick user API and socket flow.
		console.info("TODO: kick user", user?.id)
	}

	return (
		<Dialog
			open={openProfilePopup}
			onClose={handleCloseProfilePopup}
			maxWidth="xs"
			fullWidth
			disableRestoreFocus
		>
			<DialogTitle className="pt-8 pb-8">{translate("menu.profile")}</DialogTitle>
			<Divider className="profile-dialog-divider" />
			<DialogContent>
				{user && (
					<Box className="profile-user-info">
						<TTooltip title="register.username.label" arrow placement="left">
							<i className="far fa-user mr-20" />
						</TTooltip>
						<span>{user.user_name || "-"}</span>
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

				<Grid container className="profile-dialog-actions">
					{user && !isOwnProfile && (
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
							disabled={!room || room.status !== 2 || !game || game.status !== 1}
							onClick={handleKickUser}
						>
							Kick
						</TButton>
					)}
					<TButton
						variant="outlined"
						size="medium"
						onClick={handleCloseProfilePopup}
						value="settings.close"
					/>
					{isOwnProfile && (
						<TButton
							variant="contained"
							size="small"
							onClick={handleChangePassword}
							value="settings.change-password"
						/>
					)}
				</Grid>
			</DialogContent>
		</Dialog>
	)
}
