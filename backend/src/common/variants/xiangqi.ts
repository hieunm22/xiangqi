import { fenToBoard, hasPieceAcrossRiver } from "common/board-helper"
import { INITIAL_FEN_BLACK_BOTTOM, INITIAL_FEN_BLACK_TOP } from "common/constant"
import { VariantConfig } from "./types"

export const xiangqiVariant: VariantConfig = {
	gameType: "xiangqi",
	boardRows: 10,
	boardCols: 9,
	teams: ["red", "black"],
	appliesRedFirst: true,
	pveSupported: true,

	getInitialPosition(redFirst) {
		return {
			fen: redFirst ? INITIAL_FEN_BLACK_TOP : INITIAL_FEN_BLACK_BOTTOM,
			firstTeam: redFirst ? "red" : "black"
		}
	},

	validateFen(fen) {
		try {
			fenToBoard(fen)
			return true
		} catch {
			return false
		}
	},

	flagResolver(fen, winnerTeam) {
		return hasPieceAcrossRiver(fen, winnerTeam as "red" | "black")
	},

	// Dialect: lowercase = red, uppercase = black
	formatCapturedPiece(piece, capturingTeam) {
		return capturingTeam === "red" ? piece.toUpperCase() : piece.toLowerCase()
	}
}
