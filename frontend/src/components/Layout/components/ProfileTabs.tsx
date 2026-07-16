import {
	ChangeEvent,
	useEffect,
	useRef,
	useState
} from "react"
import {
	Box,
	Divider,
	Paper,
	Skeleton,
	Typography
} from "@mui/material"
import classnames from "classnames"
import { openAlert } from "components/AlertProvider/helper"
import {
	TI,
	TSpan,
	TTooltip,
	TTypography
} from "components/TranslationTag"
import { EditableProfileField } from "./EditableProfileField"
import { PlayerAvatars } from "./PlayerAvatars"
import {
	formatNumber,
	formatTimestampToDateTimeArray,
	getCurrentUserId,
	getToken,
	requireImage
} from "common/helper"
import { useAPI } from "hooks/useAPI"
import { useProfilePopup } from "hooks/useAppContext"
import useToolkit from "hooks/useToolkit"
import { APIResponse } from "types/Common"
import {
	Achievement,
	GameHistoryItem,
	HistoryTabProps,
	ProfileTabProps,
	UpdateUserInfoResponse
} from "../types"

type GameResult = "win" | "lose" | "draw"

const getGameResult = (game: GameHistoryItem, userId: number | null): GameResult => {
	const winnerId = game.game.winner_id
	if (winnerId === null || !userId) {
		return "draw"
	}
	return winnerId === userId ? "win" : "lose"
}

const RESULT_ICON: Record<GameResult, string> = {
	win: "fas fa-trophy",
	lose: "fas fa-flag",
	draw: "fas fa-handshake history-handshake"
}

export const ProfileTab = ({ user }: ProfileTabProps) => {

	const avatarInputRef = useRef<HTMLInputElement>(null)
	const selectedAvatarFileRef = useRef<File | null>(null)

	const [isCopied, setIsCopied] = useState(false)
	const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null)
	const [hasPendingAvatarPreview, setHasPendingAvatarPreview] = useState(false)
	const [isApplyingAvatarPreview, setIsApplyingAvatarPreview] = useState(false)

	const { updateUserAvatar } = useAPI()
	const { gameStats, setProfileUser } = useProfilePopup()
	const { gameState, state } = useToolkit()
	const currentUserId = getCurrentUserId()
	const isOwnProfile = user?.id === currentUserId
	const isSameUser = user?.id === gameState.activeUserId
	const displayedAvatar = avatarPreviewUrl || requireImage(user ? user.avatar_url : "")

	useEffect(() => {
		setAvatarPreviewUrl(null)
		setHasPendingAvatarPreview(false)
		setIsApplyingAvatarPreview(false)
		selectedAvatarFileRef.current = null
	}, [user?.id, user?.avatar_url])

	useEffect(() => {
		return () => {
			if (avatarPreviewUrl) {
				URL.revokeObjectURL(avatarPreviewUrl)
			}
		}
	}, [avatarPreviewUrl])

	const handleAvatarFileChange = (event: ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0]
		if (!file) {
			return
		}

		selectedAvatarFileRef.current = file

		const previewUrl = URL.createObjectURL(file)
		setAvatarPreviewUrl(previous => {
			if (previous) {
				URL.revokeObjectURL(previous)
			}
			return previewUrl
		})
		setHasPendingAvatarPreview(true)

		// Allow selecting the same file again in the next attempt.
		event.target.value = ""
	}

	const handleCopyEmail = async () => {
		if (isCopied) return
		if (!user?.email) return
		try {
			await navigator.clipboard.writeText(user.email)
			setIsCopied(true)
		}
		catch {
			// console.error("Failed to copy email:", err)
			setIsCopied(false)
		}
	}

	const onAnimationEnd = () => {
		setIsCopied(false)
	}

	const applyAvatarPreview = async () => {
		if (!avatarPreviewUrl || !hasPendingAvatarPreview || !user) {
			return
		}

		const selectedFile = selectedAvatarFileRef.current
		if (!selectedFile) {
			return
		}

		setIsApplyingAvatarPreview(true)
		try {
			const token = getToken()
			if (!token) {
				await openAlert({
					title: "popup.alert.title",
					message: "Unauthorized"
				})
				return
			}

			type Response = APIResponse<Partial<UpdateUserInfoResponse>>
			const response = await updateUserAvatar(token, selectedFile) as Response
			if (!response?.success) {
				await openAlert({
					title: "popup.alert.title",
					message: response?.message ?? "Failed to update avatar"
				})
				return
			}

			setProfileUser({
				...user,
				avatar_seq: response.data.avatar_seq ?? user.avatar_seq,
				avatar_url: response.data.avatar_url ?? user.avatar_url,
			})

			selectedAvatarFileRef.current = null
			setHasPendingAvatarPreview(false)
			setAvatarPreviewUrl(null)
		} finally {
			setIsApplyingAvatarPreview(false)
		}
	}

	const cancelAvatarPreview = () => {
		selectedAvatarFileRef.current = null

		if (!avatarPreviewUrl) {
			setHasPendingAvatarPreview(false)
			return
		}

		URL.revokeObjectURL(avatarPreviewUrl)
		setAvatarPreviewUrl(null)
		setHasPendingAvatarPreview(false)
	}

	const triggerAvatarFileDialog = () => {
		avatarInputRef.current?.click()
	}

	const copyEmailClass = isCopied ? "fas fa-circle-check copied-icon" : "fad fa-copy cursor-pointer"

	return (
		<>
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
						<Skeleton variant="circular" className="avatar-skeleton" />
					) : (
						<>
							<div className="profile-avatar-hover-zone">
								<img
									src={displayedAvatar}
									alt={user?.display_name}
									className="profile-avatar"
								/>
								{isOwnProfile && (
									<>
										<input
											ref={avatarInputRef}
											type="file"
											accept="image/*"
											onChange={handleAvatarFileChange}
											className="avatar-file-input"
										/>
										<button
											type="button"
											className="avatar-change-button"
											onClick={triggerAvatarFileDialog}
										>
											<i className="fal fa-camera" />
										</button>
									</>
								)}
							</div>
							{isOwnProfile && hasPendingAvatarPreview && (
								<div className="avatar-preview-actions">
									<button
										type="button"
										className="avatar-preview-action apply"
										disabled={isApplyingAvatarPreview}
										onClick={applyAvatarPreview}
									>
										{isApplyingAvatarPreview
											? <i className="fas fa-spinner fa-pulse" />
											: <TI className="fas fa-check" title="profile.button.save" />}
									</button>
									<button
										type="button"
										className="avatar-preview-action cancel"
										disabled={isApplyingAvatarPreview}
										onClick={cancelAvatarPreview}
									>
										<TI className="fas fa-times" title="profile.button.cancel" />
									</button>
								</div>
							)}
						</>
					)}
				</Box>

				<Box className="profile-user-info">
					<TTooltip title="register.username.label" arrow placement="left">
						<i className="fad fa-user mr-20" />
					</TTooltip>
					{isSameUser
						? (<a href={`https://facebook.com/${user!.user_name}`} target="_blank" rel="noopener noreferrer">
							{user!.user_name}
						</a>)
						: <Skeleton variant="text" width="75%" height={24} />}

					<TTooltip title="register.display-name.label" arrow placement="left">
						<i className="fad fa-tag" />
					</TTooltip>
					{isSameUser
						? (
							<EditableProfileField
								className="info-with-pen"
								editable={isOwnProfile}
								field="display_name"
								value={user!.display_name}
								type="text"
							/>
						)
						: <Skeleton variant="text" width="65%" height={24} />}

					<TTooltip title="register.email.label" arrow placement="left">
						<i className="fad fa-envelope" />
					</TTooltip>
					{isSameUser
						? (
							<EditableProfileField
								className="email-with-copy"
								editable={isOwnProfile}
								extraActions={
									<TI
										className={copyEmailClass}
										onClick={handleCopyEmail}
										onAnimationEnd={onAnimationEnd}
										title="Copy email"
									/>
								}
								field="email"
								renderDisplay={value => <a href={`mailto:${value}`}>{value}</a>}
								type="email"
								value={user!.email}
							/>
						)
						: <Skeleton variant="text" width="90%" height={24} />}

					<TTooltip title="register.username.label" arrow placement="left">
						<i className="fad fa-coins mr-20" />
					</TTooltip>
					{isSameUser
						? formatNumber(user!.total_amount, state.lang)
						: <Skeleton variant="text" width="75%" height={24} />}
				</Box>
			</Box>
			<Divider className="mt-20 mb-20" sx={{ borderColor: "primary.main" }} />

			<Box className="profile-stats-title">
				<Box className="statistic win">
					{isSameUser && gameStats
						? <Typography component="span" className="statistic-value">{gameStats.win}</Typography>
						: <Skeleton variant="text" width="90%" height={36} />}
					<TTypography color="textPrimary" className="statistic-label" content="game.label.win" />
				</Box>
				<Box className="statistic draw">
					{isSameUser && gameStats
						? <Typography component="span" className="statistic-value">{gameStats.draw}</Typography>
						: <Skeleton variant="text" width="90%" height={36} />}
					<TTypography color="textPrimary" className="statistic-label" content="game.label.draw" />
				</Box>
				<Box className="statistic lose">
					{isSameUser && gameStats
						? <Typography component="span" className="statistic-value">{gameStats.lose}</Typography>
						: <Skeleton variant="text" width="90%" height={36} />}
					<TTypography color="textPrimary" className="statistic-label" content="game.label.lose" />
				</Box>
			</Box>
		</>
	)
}

export const ProfileAchievement = ({ achievements }: { achievements: Achievement[] | null }) => (
	<Box className="profile-achievements">
		{achievements === null
			? Array.from({ length: 12 }).map((_, index) => (
				<Skeleton className="achievement-loading" key={index} variant="rounded" />
			))
			: achievements.map((achievement: Achievement) => {
				const itemClass = classnames("achievement-item", {
					earned: achievement.earned,
				})
				return (
					<Box key={achievement.id} className={itemClass}>
						<Box className="achievement-icon">
							<i className={achievement.earned ? "fas fa-trophy" : "fal fa-lock"} />
						</Box>
						<Box className="achievement-info">
							<TSpan content={achievement.name} />
						</Box>
					</Box>
				)
			})}
	</Box>
)

export const HistoryTab = (props: HistoryTabProps) => {
	const { gameHistories, onOpenReplay } = props
	const { gameState, state } = useToolkit()

	return (
		<Box className="profile-history">
			{gameHistories === null
				? Array.from({ length: 4 }).map((_, index) => (
					<Skeleton key={index} variant="rounded" height={64} />
				))
				: gameHistories.length === 0
					? <TTypography content="page.history.no-games" />
					: gameHistories.map(item => {
						const [dateLabel, timeLabel] = item.game.ends_at
							? formatTimestampToDateTimeArray(String(item.game.ends_at), state.lang)
							: [null, ""]
						const result = getGameResult(item, gameState.activeUserId)
						return (
							<Paper
								key={item.game.gameId}
								className="game-history-item"
								variant="outlined"
								onClick={() => onOpenReplay(item)}
							>
								<Box className="game-history-header">
									<TTypography
										variant="caption"
										color="primary"
										content={dateLabel ?? "common.date.today"}
									/>
									<Typography variant="caption" color="secondary">
										{timeLabel}
									</Typography>
								</Box>
								<Box className="game-history-content">
									<PlayerAvatars game={item} />
									<span className={`game-score ${result}`}>
										{item.amount !== 0
											? item.amount.toLocaleString(state.lang)
											: <i className={RESULT_ICON[result]} />}
									</span>
								</Box>
							</Paper>
						)
					})}
		</Box>
	)
}
