import { Piece, PieceCharacter, Team } from "types/GameState"

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

export const markerPositions: Array<[number, number]> = [
	[1, 2],
	[7, 2],
	[0, 3],
	[2, 3],
	[4, 3],
	[6, 3],
	[8, 3],
	[0, 6],
	[2, 6],
	[4, 6],
	[6, 6],
	[8, 6],
	[1, 7],
	[7, 7],
]

export const fenPieceMap: Record<PieceCharacter, Piece> = {
	g: "general",
	a: "advisor",
	e: "elephant",
	h: "horse",
	r: "chariot",
	c: "cannon",
	s: "soldier",

	G: "general",
	A: "advisor",
	E: "elephant",
	H: "horse",
	R: "chariot",
	C: "cannon",
	S: "soldier",
}

export const pieceFenMap: Record<Piece, PieceCharacter> = {
	general: "g",
	advisor: "a",
	elephant: "e",
	horse: "h",
	chariot: "r",
	cannon: "c",
	soldier: "s"
}

export const INITIAL_BOARD_FEN = "RHEAGAEHR/9/1C5C1/S1S1S1S1S/9/9/s1s1s1s1s/1c5c1/9/rheagaehr"
