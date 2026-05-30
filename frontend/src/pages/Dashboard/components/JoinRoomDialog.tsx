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
	Tooltip
} from "@mui/material"
import BoardImage from "assets/xiangqi-board.png"
import { TButton } from "components/TranslationTag"
import { requireImage } from "common/helper"
import { useJoinRoomDialogContext } from "hooks/useAppContext"
import { SeatAvatarProps } from "../types"

const SeatAvatar = ({ user, isHost }: SeatAvatarProps) => {
	const avatar = user
		? (
			<Avatar
				className="dashboard__seat-avatar"
				src={requireImage(user.avatar_url || "")}
				alt={user.display_name}
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
	const { room, closeJoinRoom } = useJoinRoomDialogContext()

	// Keep the dialog mounted but inert until a room is chosen. MUI handles
	// open=false cleanly without touching room data.
	const players = room?.users.slice(0, 2) ?? []
	const spectators = room?.users.slice(2) ?? []

	const handleJoin = () => {
		if (!room) return
		const roomId = room.id
		closeJoinRoom()
		navigate(`/room/${roomId}`)
	}

	const handleDialogClose = (_: React.SyntheticEvent, reason: string) => {
		console.log(reason)
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
				<Stack spacing={2} alignItems="center" sx={{ pt: 1 }}>
					<Stack
						direction="row"
						alignItems="center"
						justifyContent="space-evenly"
						gap={3}
					>
						<SeatAvatar user={players[0]} isHost={Boolean(players[0])} />
						<img src={BoardImage} alt="Board" className="dashboard__join-room-board" />
						<SeatAvatar user={players[1]} isHost={false} />
					</Stack>

					{spectators.length > 0 && (
						<Stack
							direction="row"
							flexWrap="wrap"
							justifyContent="center"
							rowGap={1}
							columnGap={0.5}
							sx={{ width: "100%" }}
						>
							{spectators.map(spectator => (
								<Tooltip
									key={spectator.id}
									title={spectator.display_name}
									arrow
									placement="top"
								>
									<Avatar
										className="dashboard__avatar"
										src={requireImage(spectator.avatar_url || "")}
										alt={spectator.display_name}
									>
										{spectator.display_name.trim().charAt(0).toUpperCase() || "U"}
									</Avatar>
								</Tooltip>
							))}
						</Stack>
					)}
				</Stack>
			</DialogContent>
			<Divider sx={{ borderColor: "primary.main" }} />
			<DialogActions sx={{ px: 3, pb: 2 }}>
				<TButton variant="contained" onClick={handleJoin} value="dashboard.popup.join-room" />
				<TButton onClick={closeJoinRoom} value="popup.confirm.cancel" />
			</DialogActions>
		</Dialog>
	)
}
