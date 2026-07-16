import { MAX_DIFFICULTY, MIN_DIFFICULTY } from "./constants"
import { BotDifficulty } from "../enums"

export interface DifficultyConfig {
	// UCI Skill Level option (0–20). Lower = engine deliberately plays weaker.
	skillLevel: number
	// Search depth cap. Lower = shallower lookahead, faster + weaker.
	depth: number
	// Hard time budget per move in ms. Lower = engine has less time to think.
	movetimeMs: number
	// Tag for logs/telemetry.
	label: string
}

/**
 * 5 difficulty tiers tuned for a noticeable strength gap between adjacent levels.
 *
 * - Beginner / Amateur lean on a low Skill Level + tiny depth to introduce blunders.
 * - Intermediate is a casual club-player baseline.
 * - Advanced / Master remove the artificial weakening and let the engine think longer.
 */
const TABLE: Record<BotDifficulty, DifficultyConfig> = {
	[BotDifficulty.BEGINNER]: { skillLevel: 0, depth: 1, movetimeMs: 100, label: "beginner" },
	[BotDifficulty.AMATEUR]: { skillLevel: 5, depth: 3, movetimeMs: 300, label: "amateur" },
	[BotDifficulty.INTERMEDIATE]: { skillLevel: 10, depth: 7, movetimeMs: 800, label: "intermediate" },
	[BotDifficulty.ADVANCED]: { skillLevel: 15, depth: 12, movetimeMs: 2000, label: "advanced" },
	[BotDifficulty.MASTER]: { skillLevel: 20, depth: 18, movetimeMs: 3500, label: "master" }
}

export const getDifficultyConfig = (level: number): DifficultyConfig => {
	if (!Number.isInteger(level) || level < MIN_DIFFICULTY || level > MAX_DIFFICULTY) {
		throw new Error(
			`Invalid difficulty: ${level}. Expected integer in [${MIN_DIFFICULTY}, ${MAX_DIFFICULTY}].`
		)
	}
	return TABLE[level as BotDifficulty]
}

export const isValidDifficulty = (level: number) =>
	Number.isInteger(level)
	&& level >= MIN_DIFFICULTY
	&& level <= MAX_DIFFICULTY
