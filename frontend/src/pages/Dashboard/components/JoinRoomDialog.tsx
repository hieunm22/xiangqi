import { useEffect, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import {
	Avatar,
	Box,
	Dialog,
	DialogActions,
	DialogContent,
	DialogTitle,
	Divider,
	Stack,
} from "@mui/material"
import BoardImage from "assets/xiangqi-board.png"
import { PopupState } from "common/enums"
import { openAlert } from "components/AlertProvider"
import { TButton, TTooltip } from "components/TranslationTag"
import { UserAvatarGroup } from "./UserAvatar"
import { getToken, requireImage } from "common/helper"
import { useAPI } from "hooks/useAPI"
import { useProfilePopup } from "hooks/useAppContext"
import useToolkit from "hooks/useToolkit"
import useLayoutAuth from "../hook"
import { setPopup } from "toolkit/slice/game"
import { Team } from "types/GameState"
import { DashboardRoom, SeatAvatarProps } from "../types"

let inviteHandler: ((room: DashboardRoom) => void) | null = null

export function openJoinRoom(room: DashboardRoom) {
	inviteHandler && inviteHandler(room)
}

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
				? <TTooltip title={user.display_name} arrow placement="top">{avatar}</TTooltip>
				: avatar}
		</Box>
	)
}

export const JoinRoomDialog = () => {
	const navigate = useNavigate()
	const location = useLocation()
	const { joinRoom, leaveRoom } = useAPI()
	const { gameState, dispatch } = useToolkit()
	const { showProfilePopup } = useLayoutAuth()
	const { profileUser } = useProfilePopup()
	const [room, setRoom] = useState<DashboardRoom | null>(null)
	const [isJoining, setIsJoining] = useState(false)

	useEffect(() => {
		// The dialog can be opened from anywhere
		inviteHandler = (nextRoom: DashboardRoom) => {
			setRoom(nextRoom)
			dispatch(setPopup(PopupState.JOIN_ROOM))
		}
		return () => { inviteHandler = null }
	}, [])

	const isOpen = gameState.popupState === PopupState.JOIN_ROOM

	const onCloseJoinRoom = () => {
		dispatch(setPopup(PopupState.NONE))
		setRoom(null)
	}

	const players = room?.users.filter(u => u.team !== null) ?? []
	const host = room?.users.find(u => u.id === room?.host_id) ?? null
	const opponent = players.find(u => u.id !== room?.host_id) ?? null
	const spectators = room?.users.filter(u => u.team === null && u.id !== room?.host_id) ?? []

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

		// If the user is currently inside another room, leave it before joining
		// the new one so they don't keep a seat in two rooms at once.
		if (location.pathname.startsWith("/room/")) {
			const currentRoomId = Number(location.pathname.substring("/room/".length))
			if (Number.isInteger(currentRoomId) && currentRoomId > 0 && currentRoomId !== room.id) {
				await leaveRoom(token, currentRoomId)
			}
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

	const tooltipDisabled = () => {
		if (!canAffordBet) {
			return "room.messages.insufficient-amount"
		} else if (players.length === 2) {
			return "room.messages.all-seats-occupied"
		}
		return ""
	}

	return (
		<Dialog
			open={isOpen}
			fullWidth
			onClose={handleDialogClose}
			slotProps={{
				backdrop: { sx: { pointerEvents: "none" } }
			}}
		>
			<DialogTitle align="center">{room?.name}</DialogTitle>
			<Divider sx={{ borderColor: "primary.main" }} />
			<DialogContent>
				<Stack className="dashboard__join-room-user-stack" >
					<Stack direction="row" className="dashboard__join-room-player-stack">
						<SeatAvatar
							user={host || null}
							isHost
							onUserClick={showProfilePopup}
						/>
						<img src={BoardImage} alt="Board" className="dashboard__join-room-board" />
						<SeatAvatar
							user={opponent || null}
							isHost={false}
							onUserClick={showProfilePopup}
						/>
					</Stack>

					{spectators.length > 0 && (
						<UserAvatarGroup
							users={spectators}
							type="primary"
							maxVisible={6}
							onUserClick={showProfilePopup}
						/>)
					}
				</Stack>
			</DialogContent>
			<Divider sx={{ borderColor: "primary.main" }} />
			<DialogActions className="dashboard__join-room-actions">
				<TTooltip
					title={tooltipDisabled()}
					arrow
					placement="top"
				>
					<span>
						<TButton
							className="dashboard__action-btn"
							color="success"
							variant="contained"
							onClick={handlePlay}
							value="dashboard.popup.play"
							disabled={players.length === 2 || isJoining || !canAffordBet}
							startIcon={<i className="far fa-play" />}
						/>
					</span>
				</TTooltip>
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
		</Dialog>
	)
}
