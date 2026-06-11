import { useState } from "react"
import { useNavigate } from "react-router-dom"
import {
	Avatar,
	Box,
	Dialog,
	DialogActions,
	DialogContent,
	DialogTitle,
	Divider,
	Stack,
	Tooltip,
} from "@mui/material"
import BoardImage from "assets/xiangqi-board.png"
import { openAlert } from "components/AlertProvider"
import { TButton } from "components/TranslationTag"
import { UserAvatarGroup } from "./UserAvatar"
import { getToken, requireImage } from "common/helper"
import { useAPI } from "hooks/useAPI"
import { useJoinRoomDialogContext } from "hooks/useAppContext"
// import useLayoutAuth from "../hooks"
import { Team } from "types/GameState"
import { SeatAvatarProps } from "../types"

const SeatAvatar = ({ user, isHost, onUserClick }: SeatAvatarProps) => {
	const avatarClass = onUserClick ? "dashboard__seat-avatar cursor-pointer" : "dashboard__seat-avatar"
	const avatar = user
		? (
			<Avatar
				className={avatarClass}
				src={requireImage(user.avatar_url || "")}
				alt={user.display_name}
				onClick={onUserClick && user ? () => onUserClick(user.id) : undefined}
			>
				{user.display_name.trim().charAt(0).toUpperCase() || "U"}
			</Avatar>
		)
		: (
			<Avatar className="dashboard__seat-avatar">
				<i className="fas fa-user" />
			</Avatar>
		)

	return (
		<Box className="dashboard__seat">
			{isHost
				? <i className="fas fa-crown dashboard__seat-crown" />
				: <div className="dashboard__seat-crown-placeholder" />}
			{user
				? <Tooltip title={user.display_name} arrow placement="top">{avatar}</Tooltip>
				: avatar}
		</Box>
	)
}

export const JoinRoomDialog = () => {
	const navigate = useNavigate()
	const { joinRoom } = useAPI()
	const { room, closeJoinRoom } = useJoinRoomDialogContext()
	// const { loadUserData } = useLayoutAuth()
	const [isJoining, setIsJoining] = useState(false)

	const players = room?.users.slice(0, 2) ?? []
	const spectators = room?.users.slice(2) ?? []

	const joinAndNavigate = async (team?: Team | null) => {
		if (!room || isJoining) {
			return
		}

		const token = getToken()
		if (!token) {
			return
		}

		setIsJoining(true)
		const response = await joinRoom(token, room.id, team)
		setIsJoining(false)

		if (!response?.success) {
			await openAlert({
				message: response?.message || "join-room.messages.internal-server-error"
			})
			return
		}

		closeJoinRoom()
		navigate(`/room/${room.id}`)
	}

	const handlePlay = async () => {
		await joinAndNavigate()
	}

	const handleView = async () => {
		await joinAndNavigate(null)
	}

	const handleDialogClose = (_: React.SyntheticEvent, reason: string) => {
		if (reason === "escapeKeyDown") {
			closeJoinRoom()
		}
	}

	return (
		<Dialog
			open={!!room}
			fullWidth
			onClose={handleDialogClose}
			slotProps={{
				backdrop: { sx: { pointerEvents: "none" } }
			}}
		>
			<DialogTitle align="center">{room?.name}</DialogTitle>
			<Divider sx={{ borderColor: "primary.main" }} />
			<DialogContent>
				<Stack spacing={2} sx={{ alignItems: "center" }} className="pt-8">
					<Stack
						direction="row"
						sx={{ alignItems: "center", justifyContent: "space-evenly", gap: 8 }}
					>
						<SeatAvatar
							user={players[0]}
							isHost={Boolean(players[0])}
							// onUserClick={loadUserData}
						/>
						<img src={BoardImage} alt="Board" className="dashboard__join-room-board" />
						<SeatAvatar
							user={players[1]}
							isHost={false}
							// onUserClick={loadUserData}
						/>
					</Stack>

					{spectators.length > 0 && (
						<UserAvatarGroup
							users={spectators}
							type="primary"
							maxVisible={6}
							// onUserClick={loadUserData}
						/>)
					}
				</Stack>
			</DialogContent>
			<Divider sx={{ borderColor: "primary.main" }} />
			<DialogActions className="dashboard__join-room-actions">
				<TButton
					className="dashboard__action-btn"
					color="success"
					variant="contained"
					onClick={handlePlay}
					value="dashboard.popup.play"
					disabled={players.length === 2 || isJoining}
					startIcon={<i className="fas fa-play" />}
				/>
				<TButton
					className="dashboard__action-btn"
					color="primary"
					variant="contained"
					onClick={handleView}
					value="dashboard.popup.view"
					disabled={isJoining}
					startIcon={<i className="fas fa-eye" />}
				/>
				<TButton
					className="dashboard__action-btn"
					color="error"
					variant="contained"
					onClick={closeJoinRoom}
					disabled={isJoining}
					value="popup.confirm.cancel"
					startIcon={<i className="fas fa-xmark" />}
				/>
			</DialogActions>
		</Dialog>
	)
}
