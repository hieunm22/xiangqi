import { Piece, PieceCharacter } from "types/GameState"

export const pieceSymbolByType: Record<PieceCharacter, string> = {
	"G": "將",
	"A": "士",
	"E": "象",
	"H": "馬",
	"R": "車",
	"C": "砲",
	"S": "卒",

	"g": "帥",
	"a": "仕",
	"e": "相",
	"h": "傌",
	"r": "俥",
	"c": "炮",
	"s": "兵",
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

export const INITIAL_FEN_BLACK_TOP = "RHEAGAEHR/9/1C5C1/S1S1S1S1S/9/9/s1s1s1s1s/1c5c1/9/rheagaehr"
export const INITIAL_FEN_BLACK_BOTTOM = "rheagaehr/9/1c5c1/s1s1s1s1s/9/9/S1S1S1S1S/1C5C1/9/RHEAGAEHR"
export const EMPTY_BOARD_FEN = "9/9/9/9/9/9/9/9/9/9"

export const MOVE_SOUND_URL = "/xiangqi/sound/move.mp3"
export const CAPTURE_SOUND_URL = "/xiangqi/sound/capture.mp3"
export const GAME_START_SOUND_URL = "/xiangqi/sound/gong-game-start-end.mp3"
