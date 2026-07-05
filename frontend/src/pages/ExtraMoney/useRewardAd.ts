import { useState } from "react"
import { getToken } from "common/helper"
import useToolkit from "hooks/useToolkit"
import { APIResponse } from "types/Common"

interface UseRewardAdParams<T> {
	canWatch: boolean
	claim: (token: string) => Promise<APIResponse<T> | undefined>
	onClaimed: (data: T) => void
	errorLabel: string
}

// Shared "watch a rewarded ad, then claim" flow for the reward tabs
export function useRewardAd<T>(props: UseRewardAdParams<T>) {
	const { canWatch, claim, onClaimed, errorLabel } = props
	const { state } = useToolkit()
	const [adOpen, setAdOpen] = useState(false)
	const [isClaiming, setIsClaiming] = useState(false)

	// Runs the claim request and applies the result. Called by RewardAdDialog after
	// a full ad view, or directly (no ad) in debug mode.
	const claimReward = async () => {
		const token = getToken()
		if (!token) return

		setIsClaiming(true)
		try {
			const response = await claim(token)
			if (response?.success && response.data) {
				onClaimed(response.data)
			}
		} catch (error) {
			console.error(errorLabel, error)
		} finally {
			setIsClaiming(false)
		}
	}

	const openAd = () => {
		if (isClaiming || !canWatch) return
		// Debug mode skips the ad entirely and claims the reward straight away.
		if (state.debugMode) {
			claimReward()
			return
		}
		setAdOpen(true)
	}

	const closeAd = () => setAdOpen(false)

	return { adOpen, isClaiming, openAd, closeAd, claimReward }
}
