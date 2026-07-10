export type CellStatus = "collected" | "current" | "upcoming"

// claimed rewards come first (grey), the next one to claim is current
// (highlighted), the rest are upcoming. `currentClaimable` guards the current
// highlight: when false (e.g. today's daily chest is already taken) the next
// cell reads as upcoming until it becomes claimable again.
export const getCellStatus = (index: number, claimed: number, currentClaimable: boolean) => {
	if (index < claimed) return "collected"
	if (index === claimed && currentClaimable) return "current"
	return "upcoming"
}

export const formatCountdown = (ms: number) => {
	const totalSeconds = Math.max(0, Math.floor(ms / 1000))
	const hours = Math.floor(totalSeconds / 3600)
	const minutes = Math.floor((totalSeconds % 3600) / 60)
	const seconds = totalSeconds % 60
	const pad = (value: number) => String(value).padStart(2, "0")
	return `${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`
}
