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

export const INITIAL_FEN_BLACK_TOP = "RHEAGAEHR/9/1C5C1/S1S1S1S1S/9/9/s1s1s1s1s/1c5c1/9/rheagaehr"
export const INITIAL_FEN_BLACK_BOTTOM = "rheagaehr/9/1c5c1/s1s1s1s1s/9/9/S1S1S1S1S/1C5C1/9/RHEAGAEHR"

export const EMPTY_BOARD_FEN = "9/9/9/9/9/9/9/9/9/9"

export const MOVE_SOUND_URL = "https://static1.squarespace.com/static/5fae7ee3a079b0732627205c/t/60884916e7fb801d2673eb74/1644222482798/move.mp3"

export const CAPTURE_SOUND_URL = "https://static1.squarespace.com/static/5fae7ee3a079b0732627205c/t/6088493f3e39f37c0fe2f758/1644222482803/capture.mp3"

export const GAME_START_SOUND_URL = "https://static1.squarespace.com/static/5fae7ee3a079b0732627205c/t/60884966942f8d12c0d2c2fe/1644222482787/gong-game-start-end.mp3"
