export type LuckySpins = {
	spins: number
	pending: boolean
}

export type BonusCoins = {
	claimed: number
	pending?: boolean
	reward?: number
}

export type DailyBonus = {
	claimed: number
	canClaim?: boolean
	reward?: number
}

export type SelectedTab = {
	selected_tab: number
}

export interface ClaimButtonIconProps {
	isClaiming: boolean
	icon: string
}
