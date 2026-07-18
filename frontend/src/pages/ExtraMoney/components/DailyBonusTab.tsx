import { useEffect, useState } from "react"
import classnames from "classnames"
import { Box } from "@mui/material"
import { LS_LANGUAGE } from "common/constant"
import RewardAdDialog from "components/RewardAdDialog"
import { TButton, TTypography } from "components/TranslationTag"
import { ClaimIconButton } from "./Icons"
import RewardGridSkeleton from "./RewardGridSkeleton"
import {
	formatNumber,
	getTimeToNextSlot,
	getToken,
	logger
} from "common/helper"
import { formatCountdown, getCellStatus } from "../rewardHelpers"
import { useAPI } from "hooks/useAPI"
import { useRewardAd } from "../useRewardAd"
import { translate } from "locales/translate"
import { DailyBonus } from "../types"

const DAILY_REWARDS = [1000, 1200, 1400, 1600, 1800, 2000]
const FINAL_REWARD = 4000
const FINAL_INDEX = DAILY_REWARDS.length
// Daily bonus resets at 00:00 GMT (a 24-hour slot).
const DAY_HOURS = 24

export default function DailyBonusTab() {
	const { claimDailyBonus, getDailyBonus } = useAPI()
	const lang = localStorage.getItem(LS_LANGUAGE) || "en"
	const [timeLeft, setTimeLeft] = useState(() => getTimeToNextSlot(DAY_HOURS))
	// Days already claimed in the current streak; also the index of the next day.
	const [claimed, setClaimed] = useState(0)
	// Whether today's chest can still be claimed (one per 24h GMT day).
	const [canClaim, setCanClaim] = useState(false)
	const [isLoading, setIsLoading] = useState(true)

	const {
		adOpen,
		isClaiming,
		
		openAd,
		claimReward,
		closeAd,
		collect,
	} = useRewardAd<DailyBonus>({
		canWatch: canClaim,
		claim: claimDailyBonus,
		onClaimed: (data) => {
			setClaimed(data.claimed)
			// Only one chest per day: today's is now spent.
			setCanClaim(false)
		},
	})

	// Load the persisted streak on entry.
	useEffect(() => {
		const loadProgress = async () => {
			const token = getToken()
			if (!token) {
				setIsLoading(false)
				return
			}

			try {
				const response = await getDailyBonus(token)
				if (response?.success && response.data) {
					setClaimed(response.data.claimed)
					setCanClaim(Boolean(response.data.canClaim))
				}
			} catch (error) {
				logger.error("Failed to load daily bonus:", error)
			} finally {
				setIsLoading(false)
			}
		}

		loadProgress()
	}, [])

	// Tick the countdown every second toward the next 00:00 GMT reset.
	useEffect(() => {
		const timer = setInterval(() => setTimeLeft(getTimeToNextSlot(DAY_HOURS)), 1000)
		return () => clearInterval(timer)
	}, [])

	const renderCell = (index: number, amount: number, isFinal: boolean) => {
		const status = getCellStatus(index, claimed, canClaim)
		const className = classnames("bonus-cell", {
			[`bonus-cell--${status}`]: true,
			"bonus-cell--treasure": isFinal
		})

		return (
			<Box key={index} className={className}>
				<span className="bonus-day">
					{translate("extra-money.daily-bonus.day")}
					&nbsp;
					{index + 1}
				</span>
				<i className="fad fa-gift bonus-icon" />
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
		<Box className="daily-bonus-tab">
			<TTypography
				variant="subtitle1"
				className="bonus-subtitle"
				align="center"
				content="extra-money.daily-bonus.subtitle"
			/>

			{isLoading
				? <RewardGridSkeleton isDaily />
				: (
					<Box className="bonus-grid">
						{DAILY_REWARDS.map((amount, index) => renderCell(index, amount, false))}
						{renderCell(FINAL_INDEX, FINAL_REWARD, true)}
					</Box>
				)}

			{!isLoading && (canClaim
				? (
					<Box className="get-reward">
						<TButton
							className="collect-btn"
							variant="contained"
							color="success"
							disabled={isClaiming || adOpen}
							startIcon={<ClaimIconButton isClaiming={isClaiming} icon="fa-hand-holding-dollar" />}
							value="extra-money.bonus-coin.collect"
							onClick={collect}
						/>
						<TButton
							className="watch-video-btn"
							variant="contained"
							color="warning"
							disabled={isClaiming || adOpen}
							startIcon={<ClaimIconButton isClaiming={isClaiming} icon="fa-circle-play" />}
							value="extra-money.bonus-coin.watch-video"
							onClick={openAd}
						/>
					</Box>
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
