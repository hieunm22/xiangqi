/**
 * Five named difficulty tiers exposed to the client. Stored as small integers in
 * `Game.bot_difficulty` so they survive across processes / DB without coupling to
 * the enum names.
 */
export enum BotDifficulty {
	BEGINNER = 1,
	AMATEUR = 2,
	INTERMEDIATE = 3,
	ADVANCED = 4,
	MASTER = 5
}
