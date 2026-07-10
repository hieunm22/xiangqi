import classnames from "classnames"
import { Tooltip } from "@mui/material"
import { PopupState } from "common/enums"
import { TI } from "components/TranslationTag"
import { formatNumber, getCurrentUserId, requireImage } from "common/helper"
import useToolkit from "hooks/useToolkit"
import useLayoutAuth from "pages/Dashboard/hook"
import { formatClock } from "../useGameClock"
import { setInviteRoomId, setPopup, setRoomHostId } from "toolkit/slice/game"
import { PlayerInfoCardProps } from "../types"

// Below this many ms remaining, the clock turns "low" (red/urgent styling).
const LOW_TIME_MS = 30_000

// Bots are rated on a fixed 1–5 difficulty scale
const MAX_BOT_LEVEL = 5

const TOTAL_AMOUNT_COMPACT_UNITS = ["k", "m", "b"]

const formatCompactTotalAmount = (amount: number | undefined, lang: string) => {
	if (typeof amount !== "number") {
		return formatNumber(amount, lang)
	}

	let unitIndex = -1
	let scaled = amount

	while (scaled >= 1000 && unitIndex < TOTAL_AMOUNT_COMPACT_UNITS.length - 1) {
		scaled /= 1000
		unitIndex += 1
	}

	if (unitIndex < 0) {
		return formatNumber(amount, lang)
	}

	const integerDigits = Math.max(1, Math.floor(Math.log10(scaled)) + 1)
	const fractionDigits = Math.max(0, 4 - integerDigits)
	const roundedScaled = Number(scaled.toFixed(fractionDigits))

	if (roundedScaled >= 1000 && unitIndex < TOTAL_AMOUNT_COMPACT_UNITS.length - 1) {
		const nextScaled = roundedScaled / 1000
		const nextIntegerDigits = Math.max(1, Math.floor(Math.log10(nextScaled)) + 1)
		const nextFractionDigits = Math.max(0, 4 - nextIntegerDigits)
		const nextRoundedScaled = Number(nextScaled.toFixed(nextFractionDigits))

		return `${nextRoundedScaled.toLocaleString(lang, {
			minimumFractionDigits: 0,
			maximumFractionDigits: nextFractionDigits
		})}${TOTAL_AMOUNT_COMPACT_UNITS[unitIndex + 1]}`
	}

	return `${roundedScaled.toLocaleString(lang, {
		minimumFractionDigits: 0,
		maximumFractionDigits: fractionDigits
	})}${TOTAL_AMOUNT_COMPACT_UNITS[unitIndex]}`
}

export default function PlayerInfoCard(props: PlayerInfoCardProps) {
	const {
		active = false,
		botLevel,
		remainingMs = null,
		roomId,
		team,
		user,		
	} = props
	const { showProfilePopup } = useLayoutAuth()
	const { state, gameState, dispatch } = useToolkit()

	const fullAvatarUrl = requireImage(user?.avatar_url || "")
	const currentUserId = getCurrentUserId()

	if (!user) {
		if (props.roomHostId !== currentUserId) {
			return <div className="player-info-card" />
		}
		const containerClass = classnames(
			"player-info-card empty-slot cursor-pointer",
			`team-${team}`
		)
		const handleEmptySlotClick = () => {
			if (roomId !== null) {
				dispatch(setInviteRoomId(roomId))
			}
			dispatch(setPopup(gameState.popupState | PopupState.SEARCH_USERS))
		}

		return (
			<div className={containerClass} onClick={handleEmptySlotClick}>
				<div className="player-avatar empty">
					<TI className="fas fa-user-plus" />
				</div>
			</div>
		)
	}

	const containerClass = classnames("player-info-card", `team-${team}`, {
		"active-turn": active,
	})

	const handlePlayerNameClick = () => {
		if (!user) return

		// const activeElement = document.activeElement as HTMLElement | null
		// activeElement?.blur()
		dispatch(setRoomHostId(props.roomHostId))
		showProfilePopup(user.id)
	}

	const levelStarsClass = (index: number) => {
		if (botLevel === null) return "far fa-star bot-level-star"
		return index < botLevel ? "fas fa-star bot-level-star" : "far fa-star bot-level-star"
	}

	const backReadyClass = classnames("player-back-ready-badge", {
		"is-ready": user.back_ready,
		"is-waiting": !user.back_ready
	})

	return (
		<div className={containerClass}>
			<div className="player-avatar">
				<img
					className="player-avatar-image"
					src={fullAvatarUrl}
					alt={user?.display_name}
				/>
				{user.team !== null && user.back_ready !== null && (
					<div className={backReadyClass} />
				)}
			</div>
			<div className="player-meta">
				<div
					className={classnames("player-name", { "no-popup": user.is_bot })}
					onClick={user.is_bot ? undefined : handlePlayerNameClick}
				>
					{user?.display_name}
				</div>
				{user.is_bot ? (
					botLevel !== null && (
						<div className="bot-level">
							{Array.from({ length: MAX_BOT_LEVEL }, (_, index) => (
								<i key={index} className={levelStarsClass(index)} />
							))}
						</div>
					)
				) : (
					<div className="player-total-points">
						<i className="fas fa-sack-dollar user-points" />
						<Tooltip title={formatNumber(user?.total_amount, state.lang)} arrow placement="top">
							<span
								className="data-content"
								data-content={formatCompactTotalAmount(user?.total_amount, state.lang)}
							/>
						</Tooltip>
					</div>
				)}
				{remainingMs !== null && (
					<div
						className={classnames("player-clock", {
							"is-active": active,
							"low-time": remainingMs <= LOW_TIME_MS
						})}
					>
						<i className="far fa-clock" />
						<span className="player-clock-time">{formatClock(remainingMs)}</span>
					</div>
				)}
			</div>
		</div>
	)
}
