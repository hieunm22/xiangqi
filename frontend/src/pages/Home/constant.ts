import { Piece, Team } from "types/GameState"

export const pieceSymbolByType: Record<Team, Record<Piece, string>> = {
	black: {
		general: "將",
		advisor: "士",
		elephant: "象",
		horse: "馬",
		chariot: "車",
		cannon: "砲",
		soldier: "卒",
	},
	red: {
		general: "帥",
		advisor: "仕",
		elephant: "相",
		horse: "傌",
		chariot: "俥",
		cannon: "炮",
		soldier: "兵",
	},
}