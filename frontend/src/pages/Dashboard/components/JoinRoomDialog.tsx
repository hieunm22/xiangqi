import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import classnames from "classnames"
import {
	Avatar,
	Box,
	DialogActions,
	DialogContent,
	DialogTitle,
	Divider,
	Stack,
} from "@mui/material"
import BoardImage from "assets/xiangqi-board.png"
import { PopupState } from "common/enums"
import { openAlert } from "components/AlertProvider/helper"
import { ResponsiveDialog } from "components/ResponsiveDialog"
import { TButton, TTooltip, TTypography } from "components/TranslationTag"
import { UserAvatarGroup } from "./UserAvatar"
import { getToken, requireImage } from "common/helper"
import { setJoinRoomHandler } from "./joinRoomController"
import { useAPI } from "hooks/useAPI"
import { useProfilePopup } from "hooks/useAppContext"
import useToolkit from "hooks/useToolkit"
import useLayoutAuth from "../hook"
import { setPopup } from "toolkit/slice/game"
import { Team } from "types/GameState"
import { DashboardRoom, SeatAvatarProps } from "../types"

const SeatAvatar = ({ user, isHost, onUserClick }: SeatAvatarProps) => {
	const avatarClass = classnames("dashboard__seat-avatar", {
		"cursor-pointer": onUserClick
	})
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
				? <TTooltip title={user.display_name} arrow placement="top">{avatar}</TTooltip>
				: avatar}
		</Box>
	)
}

export const JoinRoomDialog = () => {
	const navigate = useNavigate()
	const { joinRoom, leaveRoom } = useAPI()
	const { gameState, dispatch } = useToolkit()
	const { showProfilePopup } = useLayoutAuth()
	const { profileUser } = useProfilePopup()
	const { currentRoomId, isCurrentRoomPlayer, isInGame } = gameState
	const [room, setRoom] = useState<DashboardRoom | null>(null)
	const [isJoining, setIsJoining] = useState(false)

	useEffect(() => {
		// The dialog can be opened from anywhere
		setJoinRoomHandler((nextRoom: DashboardRoom) => {
			setRoom(nextRoom)
			dispatch(setPopup(PopupState.JOIN_ROOM))
		})
		return () => { setJoinRoomHandler(null) }
	}, [])

	const isOpen = gameState.popupState === PopupState.JOIN_ROOM

	const onCloseJoinRoom = () => {
		dispatch(setPopup(PopupState.NONE))
		setRoom(null)
	}

	const players = room?.users.filter(u => u.team !== null) ?? []
	const player1 = players.length > 0 ? players[0] : null
	const player2 = players.length > 1 ? players[1] : null
	const spectators = room?.users.filter(u => u.team === null) ?? []

	// Check if current user can afford this room's bet (>80% of balance disqualifies them)
	const canAffordBet = room && profileUser && profileUser.total_amount
		? (room.bet_amount === 0 || room.bet_amount * 10 <= profileUser.total_amount * 8)
		: true

	const joinAndNavigate = async (team?: Team | null) => {
		if (!room || isJoining) {
			return
		}

		const token = getToken()
		if (!token) {
			return
		}

		setIsJoining(true)

		// If the user is currently inside another room, leave it before joining the new one
		if (currentRoomId && currentRoomId > 0 && currentRoomId !== room.id) {
			await leaveRoom(token, currentRoomId)
		}

		const response = await joinRoom(token, room.id, team)
		setIsJoining(false)

		if (!response?.success) {
			await openAlert({
				message: response?.message || "join-room.messages.internal-server-error"
			})
			return
		}

		onCloseJoinRoom()
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
			onCloseJoinRoom()
		}
	}

	// Check if user is currently playing in a different room
	const isInDifferentRoom = currentRoomId != null
		&& currentRoomId > 0
		&& room
		&& room.id > 0
		&& isCurrentRoomPlayer
		&& isInGame
		&& currentRoomId !== room.id

	const getHelpTexts = () => {
		const errors: string[] = []
		if (isInDifferentRoom) {
			errors.push("room.messages.will-leave-current-room")
		}
		if (!canAffordBet) {
			errors.push("room.messages.insufficient-amount")
		}
		return errors
	}

	const handleAvatarClick = (userId: number) => {
		const activeElement = document.activeElement as HTMLElement | null
		activeElement?.blur()
		showProfilePopup(userId)
	}

	return (
		<ResponsiveDialog
			drawerAnchor="bottom"
			open={isOpen}
			fullWidth
			onClose={handleDialogClose}
			disableEnforceFocus
			slotProps={{
				backdrop: { sx: { pointerEvents: "none" } }
			}}
		>
			<DialogTitle align="center">{room?.name || "room-invite.messages.title"}</DialogTitle>
			<Divider sx={{ borderColor: "primary.main" }} />
			<DialogContent>
				<Stack className="dashboard__join-room-user-stack" >
					<Stack direction="row" className="dashboard__join-room-player-stack">
						<SeatAvatar
							user={player1}
							isHost={player1 !== null && room !== null && player1.id === room.host_id}
							onUserClick={handleAvatarClick}
						/>
						<img src={BoardImage} alt="Board" className="dashboard__join-room-board" />
						<SeatAvatar
							user={player2}
							isHost={player2 !== null && room !== null && player2.id === room.host_id}
							onUserClick={handleAvatarClick}
						/>
					</Stack>

					{spectators.length > 0 && (
						<UserAvatarGroup
							users={spectators}
							type="primary"
							maxVisible={6}
							onUserClick={handleAvatarClick}
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
					disabled={players.length === 2 || isJoining || !canAffordBet}
					startIcon={<i className="far fa-play" />}
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
					onClick={onCloseJoinRoom}
					disabled={isJoining}
					value="popup.confirm.cancel"
					startIcon={<i className="fas fa-xmark" />}
				/>
			</DialogActions>
			{getHelpTexts().length > 0 && <Box className="dashboard__join-room-help-box">
				<Stack spacing={0.5}>
					{getHelpTexts().map((helpText, index) => (
						<TTypography key={index} content={helpText} />
					))}
				</Stack>
			</Box>}
		</ResponsiveDialog>
	)
}
