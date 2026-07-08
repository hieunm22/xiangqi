// Thresholds evaluated against the `game_users` ledger (amount sign per game).
export const WIN_100_THRESHOLD = 100
export const DRAW_50_THRESHOLD = 50

export const ACHIEVEMENT_TITLE = {
	CHECKMATE_13_PIECES: "achievement.title-01",
	FIRST_WIN: "achievement.title-02",
	NO_LEGAL_MOVES: "achievement.title-03",
	DEFEAT_EQUAL_RANK_10: "achievement.title-04",
	DRAW_KING_ONLY: "achievement.title-05",
	WIN_100: "achievement.title-06",
	DRAW_50: "achievement.title-07",
	CHECKMATE_1_ATTACKER: "achievement.title-08",
	CHECKMATE_KNIGHT_ONLY: "achievement.title-09",
	CHECKMATE_PAWN_ONLY: "achievement.title-10",
	CHECKMATE_CANNON_ONLY: "achievement.title-11",
	DEFEAT_MASTER_RANK_50: "achievement.title-12"
} as const
