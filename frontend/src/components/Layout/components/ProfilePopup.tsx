import { useEffect, useState } from "react"
import {
	Box,
	Dialog,
	DialogContent,
	DialogTitle,
	Divider,
	Grid,
	Skeleton,
	Typography,
} from "@mui/material"
import { PopupState } from "common/enums"
import { openAlert } from "components/AlertProvider"
import {
	TButton,
	TI,
	TSpan,
	TTooltip,
	TTypography,
} from "components/TranslationTag"
import { formatNumber, getClaimsFromLocalStorage, getToken, requireImage } from "common/helper"
import { useAPI } from "hooks/useAPI"
import { useProfilePopup } from "hooks/useAppContext"
import useToolkit from "hooks/useToolkit"
import { translate } from "locales/translate"
import { setPopup, setRoomHostId, setUserId } from "toolkit/slice/game"
import { APIResponse } from "types/Common"
import { UserProfileWithStats } from "../types"

export const ProfilePopup = () => {
	const { gameState, state, dispatch } = useToolkit()
	const { getUserById, kickUser } = useAPI()
	const [isCopied, setIsCopied] = useState(false)
	const {
		profileUser: user,
		gameStats,
		setGameStats,
		setProfileUser
	} = useProfilePopup()

	const handleCloseProfilePopup = (_: unknown, reason: "backdropClick" | "escapeKeyDown") => {
		if (reason === "backdropClick") return
		dispatch(setUserId(null))
		dispatch(setRoomHostId(null))
		setProfileUser(null)
		setGameStats(null)
		dispatch(setPopup(PopupState.NONE))
	}

	const handleCopyEmail = async () => {
		if (isCopied) return
		if (!user?.email) return
		try {
			await navigator.clipboard.writeText(user.email)
			setIsCopied(true)
		}
		catch (err) {
			console.error("Failed to copy email:", err)
			setIsCopied(false)
		}
	}

	const onAnimationEnd = () => {
		setIsCopied(false)
	}

	const claims = getClaimsFromLocalStorage()
	const currentUserId = Number(claims?.sub)
	// const normalizedCurrentUserId = currentUserId ?? null
	const isOwnProfile = user?.id === currentUserId

	const loadRoomContext = async () => {
		if (gameState.popupState !== PopupState.PROFILE) {
			return
		}

		const token = getToken()
		if (!token) {
			return
		}

		const response = await getUserById(token, gameState.activeUserId!) as APIResponse<UserProfileWithStats>
		if (response) {
			setProfileUser(response.data.user)
			setGameStats(response.data.stats)
		}
	}

	useEffect(() => {
		loadRoomContext()
	}, [gameState.popupState, gameState.roomHostId])

	const handleSendPM = () => {
		dispatch(setUserId(gameState.activeUserId))
		dispatch(setPopup(PopupState.SEND_PM))
	}

	const handleViewHistory = () => {
		dispatch(setUserId(gameState.activeUserId))
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

	const isSameUser = user?.id === gameState.activeUserId

	return (
		<Dialog
			open={(gameState.popupState & PopupState.PROFILE) === PopupState.PROFILE}
			onClose={handleCloseProfilePopup}
			className="profile-dialog"
			fullWidth
			disableEnforceFocus
			disableAutoFocus
		>
			<DialogTitle className="pt-8 pb-8">{translate("menu.profile")}</DialogTitle>
			<Divider sx={{ borderColor: "primary.main" }} />
			<DialogContent>
				<Box
					sx={{
						display: "flex",
						flexDirection: { xs: "column", md: "row" },
						gap: 2,
						alignItems: { xs: "center", md: "flex-start" },
					}}
				>
					<Box className="profile-avatar-container">
						{!isSameUser ? (
							<Skeleton variant="circular" width="120px" height="120px" sx={{ margin: "0 auto" }} />
						) : (
							<img
								src={requireImage(user?.avatar_url || "")}
								alt={user?.display_name}
								className="profile-avatar"
							/>
						)}
					</Box>

					<Box className="profile-user-info">
						<TTooltip title="register.username.label" arrow placement="left">
							<i className="far fa-user mr-20" />
						</TTooltip>
						{isSameUser
							? (<a href={`https://facebook.com/${user.user_name}`} target="_blank" rel="noopener noreferrer">
								{user.user_name}
							</a>)
							: <Skeleton variant="text" width="75%" height={24} />}
						<TTooltip title="register.display-name.label" arrow placement="left">
							<i className="far fa-tag" />
						</TTooltip>
						{isSameUser
							? <span>{user.display_name}</span>
							: <Skeleton variant="text" width="65%" height={24} />}
						<TTooltip title="register.gender.label" arrow placement="left">
							<i className="far fa-venus-mars" />
						</TTooltip>
						{isSameUser
							? <TSpan content={user.gender ? "register.gender.male" : "register.gender.female"} />
							: <Skeleton variant="text" width="30%" height={24} />}
						<TTooltip title="register.email.label" arrow placement="left">
							<i className="far fa-envelope" />
						</TTooltip>
						<div className="email-with-copy">
							{isSameUser
								? <a href={`mailto:${user.email}`}>{user.email}</a>
								: <Skeleton variant="text" width="90%" height={24} />}
							<TI
								className={isCopied ? "fas fa-circle-check copied-icon" : "far fa-copy cursor-pointer"}
								onClick={handleCopyEmail}
								onAnimationEnd={onAnimationEnd}
								title="Copy email"
							/>
						</div>
						<TTooltip title="register.username.label" arrow placement="left">
							<i className="far fa-coins mr-20" />
						</TTooltip>
						{isSameUser
							? formatNumber(user.total_amount, state.lang)
							: <Skeleton variant="text" width="75%" height={24} />}
					</Box>
				</Box>
				<Divider className="mt-20 mb-20" sx={{ borderColor: "primary.main" }} />

				<Box className="profile-stats-title">
					<Box className="statistic win">
						{isSameUser
							? <Typography component="span" className="statistic-value">{gameStats?.win ?? -1}</Typography>
							: <Skeleton variant="text" width="90%" height={24} />}
						<TTypography color="textPrimary" className="statistic-label" content="Win" />
					</Box>
					<Box className="statistic draw">
						{isSameUser
							? <Typography component="span" className="statistic-value">{gameStats?.draw ?? -1}</Typography>
							: <Skeleton variant="text" width="90%" height={24} />}
						<TTypography color="textPrimary" className="statistic-label" content="Draw" />
					</Box>
					<Box className="statistic lose">
						{isSameUser
							? <Typography component="span" className="statistic-value">{gameStats?.lose ?? -1}</Typography>
							: <Skeleton variant="text" width="90%" height={24} />}
						<TTypography color="textPrimary" className="statistic-label" content="Lose" />
					</Box>
				</Box>

			</DialogContent>
			<Divider sx={{ borderColor: "primary.main" }} />
			<Grid container className="profile-dialog-actions">
				{!isSameUser ? (
					<>
						<Skeleton variant="rounded" width="calc(40% - 8px)" height={31} />
						<Skeleton variant="rounded" width="calc(40% - 8px)" height={31} />
						<Skeleton variant="rounded" width="calc(40% - 8px)" height={31} />
					</>
				) : (
					<>
						{!isOwnProfile && (
							<TButton
								variant="contained"
								size="small"
								color="info"
								onClick={handleSendPM}
								value="room.actions.send-pm"
								startIcon={<i className="far fa-comment" />}
							/>
						)}
						{user && (
							<TButton
								variant="contained"
								size="small"
								color="success"
								onClick={handleViewHistory}
								value="room.actions.view-history"
								startIcon={<i className="far fa-clock" />}
							/>
						)}
						{user && !isOwnProfile && gameState.roomHostId === currentUserId && (
							<TButton
								variant="contained"
								size="small"
								color="error"
								// TODO: Only allow kicking when the room is in "waiting" status
								disabled={gameState.roomHostId !== currentUserId}
								onClick={handleKickUser}
								value="room.actions.kick"
								startIcon={<i className="far fa-ban" />}
							/>
						)}
					</>
				)}
				<TButton
					variant="outlined"
					size="small"
					onClick={e => handleCloseProfilePopup(e, "escapeKeyDown")}
					value="settings.close"
					startIcon={<i className="far fa-xmark" />}
				/>
			</Grid>
		</Dialog>
	)
}
