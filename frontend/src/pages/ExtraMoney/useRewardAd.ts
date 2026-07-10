import { useState } from "react"
import { getToken } from "common/helper"
import useToolkit from "hooks/useToolkit"
import { APIResponse } from "types/Common"

interface UseRewardAdParams<T> {
	canWatch: boolean
	claim: (token: string, double: boolean) => Promise<APIResponse<T> | undefined>
	onClaimed: (data: T) => void
}

// Shared "watch a rewarded ad, then claim" flow for the reward tabs
export function useRewardAd<T>(props: UseRewardAdParams<T>) {
	const { canWatch, claim, onClaimed } = props
	const { state } = useToolkit()
	const [adOpen, setAdOpen] = useState(false)
	const [isClaiming, setIsClaiming] = useState(false)

	// Runs the claim request and applies the result.
	const runClaim = async (double: boolean) => {
		const token = getToken()
		if (!token) return

		setIsClaiming(true)
		try {
			const response = await claim(token, double)
			if (response?.success && response.data) {
				onClaimed(response.data)
			}
		} finally {
			setIsClaiming(false)
		}
	}

	// Collect the reward at face value (no ad).
	const collect = () => runClaim(false)

	// Doubled reward, granted only after a full ad view; passed to RewardAdDialog.
	const claimReward = () => runClaim(true)

	const openAd = () => {
		if (isClaiming || !canWatch) return
		// Debug mode skips the ad entirely but still grants the doubled reward straight away
		if (state.debugMode) {
			claimReward()
			return
		}
		setAdOpen(true)
	}

	const closeAd = () => setAdOpen(false)

	return {
		adOpen,
		isClaiming,

		claimReward,
		closeAd,
		collect,
		openAd,
	}
}
