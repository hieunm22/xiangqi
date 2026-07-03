import { useEffect, useState } from "react"
import classnames from "classnames"
import { Box, CircularProgress } from "@mui/material"
import { LS_LANGUAGE } from "common/constant"
import { TButton, TTypography } from "components/TranslationTag"
import RewardGridSkeleton from "./RewardGridSkeleton"
import { formatNumber, getTimeToNextSlot, getToken } from "common/helper"
import { useAPI } from "hooks/useAPI"
import { formatCountdown, getCellStatus } from "../rewardHelpers"

const BONUS_REWARDS = [800, 900, 1000, 1100, 1200, 1300]
const TREASURE_REWARD = 2000
const TREASURE_INDEX = BONUS_REWARDS.length
const TOTAL_TREASURES = TREASURE_INDEX + 1
// Bonus coins reset every 8h from 00:00 UTC (mirrors backend SLOT_HOURS).
const SLOT_HOURS = 8

export default function BonusCoinTab() {
	const { claimBonusCoin, getBonusCoins } = useAPI()
	const lang = localStorage.getItem(LS_LANGUAGE) || "en"
	const [timeLeft, setTimeLeft] = useState(() => getTimeToNextSlot(SLOT_HOURS))
	// Number of treasures already claimed this slot; also the index of the next
	// claimable treasure. Loaded from and advanced by the backend.
	const [claimed, setClaimed] = useState(0)
	const [isClaiming, setIsClaiming] = useState(false)
	const [isLoading, setIsLoading] = useState(true)

	// Load the persisted progress for the current slot on entry.
	useEffect(() => {
		const loadProgress = async () => {
			const token = getToken()
			if (!token) {
				setIsLoading(false)
				return
			}

			try {
				const response = await getBonusCoins(token)
				if (response?.success && response.data) {
					setClaimed(response.data.claimed)
				}
			} catch (error) {
				console.error("Failed to load bonus coins:", error)
			} finally {
				setIsLoading(false)
			}
		}

		loadProgress()
	}, [])

	// Tick the countdown every second, re-anchoring to the next slot boundary
	// so it wraps around cleanly when a boundary passes.
	useEffect(() => {
		const timer = setInterval(() => setTimeLeft(getTimeToNextSlot(SLOT_HOURS)), 1000)
		return () => clearInterval(timer)
	}, [])

	const handleWatchVideo = async () => {
		if (isClaiming || claimed >= TOTAL_TREASURES) return

		// TODO: play the actual reward video before claiming. For now the click
		// claims the next treasure directly.
		const token = getToken()
		if (!token) return

		setIsClaiming(true)
		try {
			const response = await claimBonusCoin(token)
			if (response?.success && response.data) {
				setClaimed(response.data.claimed)
			}
		} catch (error) {
			console.error("Failed to claim bonus coin:", error)
		} finally {
			setIsClaiming(false)
		}
	}

	const renderCell = (index: number, amount: number, isTreasure: boolean) => {
		const status = getCellStatus(index, claimed)
		const className = classnames("bonus-cell", {
			[`bonus-cell--${status}`]: true,
			"bonus-cell--treasure": isTreasure
		})

		return (
			<Box key={index} className={className}>
				<i className={`fad ${isTreasure ? "fa-treasure-chest" : "fa-coins"} bonus-icon`} />
				{status === "collected"
					? <i className="fas fa-check collected" />
					: (
						<span className="bonus-amount">
							{formatNumber(amount, lang)}
						</span>
					)}
			</Box>
		)
	}

	return (
		<Box className="bonus-coin-tab">
			<TTypography
				variant="subtitle1"
				className="bonus-subtitle"
				align="center"
				content="extra-money.bonus-coin.subtitle"
			/>

			{isLoading
				? <RewardGridSkeleton isDaily={false} />
				: (
					<Box className="bonus-grid">
						{BONUS_REWARDS.map((amount, index) => renderCell(index, amount, false))}
						{renderCell(TREASURE_INDEX, TREASURE_REWARD, true)}
					</Box>
				)}

			{!isLoading && (claimed < TOTAL_TREASURES
				? (
					<TButton
						className="watch-video-btn"
						variant="contained"
						disabled={isClaiming}
						startIcon={isClaiming ? <CircularProgress size={20} color="inherit" /> : <i className="fas fa-circle-play" />}
						value="extra-money.bonus-coin.watch-video"
						onClick={handleWatchVideo}
					/>
				)
				: (
					<Box className="bonus-next">
						<TTypography
							component="span"
							variant="h6"
							content="extra-money.bonus-coin.next-in"
						/>
						<span className="bonus-next-time">{formatCountdown(timeLeft)}</span>
					</Box>
				))}
		</Box>
	)
}
