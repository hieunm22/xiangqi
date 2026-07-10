import { useEffect, useState } from "react"
import classnames from "classnames"
import { Box } from "@mui/material"
import { LS_LANGUAGE } from "common/constant"
import RewardAdDialog from "components/RewardAdDialog"
import { TButton, TTypography } from "components/TranslationTag"
import { ClaimIconButton } from "./Icons"
import RewardGridSkeleton from "./RewardGridSkeleton"
import { formatNumber, getTimeToNextSlot, getToken } from "common/helper"
import { formatCountdown, getCellStatus } from "../rewardHelpers"
import { useAPI } from "hooks/useAPI"
import { useRewardAd } from "../useRewardAd"
import { BonusCoins } from "../types"

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
	const [isLoading, setIsLoading] = useState(true)

	const {
		adOpen,
		isClaiming,

		claimReward,
		closeAd,
		openAd
	} = useRewardAd<BonusCoins>({
		canWatch: claimed < TOTAL_TREASURES,
		claim: claimBonusCoin,
		onClaimed: (data) => setClaimed(data.claimed),
	})

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

	const renderCell = (index: number, amount: number, isTreasure: boolean) => {
		const status = getCellStatus(index, claimed, true)
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
						color="warning"
						disabled={isClaiming || adOpen}
						startIcon={<ClaimIconButton isClaiming={isClaiming} icon="fa-circle-play" />}
						value="extra-money.bonus-coin.watch-video"
						onClick={openAd}
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

			<RewardAdDialog
				open={adOpen}
				onClose={closeAd}
				onReward={claimReward}
			/>
		</Box>
	)
}
