// Frontend counterpart of the backend variant registry. Holds the per-game data
// the lobby and create-room flow branch on (team vocabulary, which config fields
// to show, board size). Board components and FEN codecs are added here later,
// when the chess board view is ported in.

import { Team } from "types/GameState"

export type GameType = "xiangqi" | "chess"

export interface VariantConfig {
	gameType: GameType
	/** i18n key for the game's display name (segmented lobby, badges). */
	labelKey: string
	/** The two seats, in move order. */
	teams: readonly [Team, Team]
	/** i18n key per team, for labels in the create-room / room UI. */
	teamLabelKeys: Record<string, string>
	/** Whether to show the "red first" toggle (xiangqi only). */
	appliesRedFirst: boolean
	/** Whether to offer the PvE / bot option. */
	pveSupported: boolean
	boardRows: number
	boardCols: number
}

const xiangqiVariant: VariantConfig = {
	gameType: "xiangqi",
	labelKey: "variant.xiangqi.name",
	teams: ["red", "black"],
	teamLabelKeys: {
		red: "variant.xiangqi.team.red",
		black: "variant.xiangqi.team.black"
	},
	appliesRedFirst: true,
	pveSupported: true,
	boardRows: 10,
	boardCols: 9
}

const chessVariant: VariantConfig = {
	gameType: "chess",
	labelKey: "variant.chess.name",
	teams: ["white", "black"],
	teamLabelKeys: {
		white: "variant.chess.team.white",
		black: "variant.chess.team.black"
	},
	appliesRedFirst: false,
	pveSupported: false,
	boardRows: 8,
	boardCols: 8
}

const VARIANTS: Record<GameType, VariantConfig> = {
	xiangqi: xiangqiVariant,
	chess: chessVariant
}

export const DEFAULT_GAME_TYPE: GameType = "xiangqi"

/** Order used by the segmented game selector in the lobby. */
export const GAME_TYPES: readonly GameType[] = ["xiangqi", "chess"]

export function isGameType(value: unknown): value is GameType {
	return value === "xiangqi" || value === "chess"
}

/** Resolve a variant config; unknown/legacy values fall back to xiangqi. */
export function getVariant(gameType: string | null | undefined): VariantConfig {
	return isGameType(gameType) ? VARIANTS[gameType] : VARIANTS[DEFAULT_GAME_TYPE]
}
