import { chessVariant } from "./chess"
import { GameType, VariantConfig } from "./types"
import { xiangqiVariant } from "./xiangqi"

export * from "./types"
export { hasSufficientMatingMaterial } from "./chess"

const VARIANTS: Record<GameType, VariantConfig> = {
	xiangqi: xiangqiVariant,
	chess: chessVariant
}

export const DEFAULT_GAME_TYPE: GameType = "xiangqi"

/** Type guard for an unknown/persisted game_type string. */
export function isGameType(value: unknown): value is GameType {
	return value === "xiangqi" || value === "chess"
}

/**
 * Resolve the variant config for a game_type. Unknown/legacy values fall back to
 * xiangqi (the historical default) rather than throwing, so old rows keep working.
 */
export function getVariant(gameType: string | null | undefined): VariantConfig {
	return isGameType(gameType) ? VARIANTS[gameType] : VARIANTS[DEFAULT_GAME_TYPE]
}

/** Whether `team` is one of the variant's two seats. */
export function isTeam(variant: VariantConfig, team: unknown): team is string {
	return typeof team === "string" && variant.teams.includes(team)
}

/** The opposing seat within a variant (used for turn toggle, bot seat, etc.). */
export function otherTeam(variant: VariantConfig, team: string): string {
	return variant.teams[0] === team ? variant.teams[1] : variant.teams[0]
}
