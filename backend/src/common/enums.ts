/**
 * Five named difficulty tiers exposed to the client.
 */
export enum BotDifficulty {
	BEGINNER = 1,
	AMATEUR = 2,
	INTERMEDIATE = 3,
	ADVANCED = 4,
	MASTER = 5
}

/**
 * `user_amount_history.type` — how a coin change was earned.
 */
export enum AmountHistoryType {
	LuckyWheel = 1,
	BonusCoin = 2,
	DailyBonusNormal = 3,
	DailyBonusDouble = 4,
}
