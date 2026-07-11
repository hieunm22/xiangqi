import { INITIAL_FEN_CHESS } from "common/constant"
import { VariantConfig } from "./types"

/**
 * Whether `winnerTeam` has enough material to checkmate, from a standard chess
 * FEN. Used for the flag-fall rule: a player who runs out of time only loses if
 * the opponent *could* mate; otherwise the game is drawn (FIDE Art. 6.9).
 *
 * Insufficient (=> draw) means no checkmate is possible by any legal sequence:
 *   - lone king
 *   - king + a single minor piece (one knight or one bishop)
 *   - king + two (or more) knights only
 *   - king + any number of bishops all on the same square colour
 * Everything else (a pawn / rook / queen, bishop + knight, or bishops on both
 * colours, or three+ knights) is sufficient.
 *
 * `winnerTeam` is "white" (uppercase pieces) or "black" (lowercase pieces).
 */
export function hasSufficientMatingMaterial(fen: string, winnerTeam: string): boolean {
	const placement = fen.trim().split(/\s+/)[0]
	const wantUpper = winnerTeam === "white"

	let knights = 0
	const bishopSquareColours = new Set<number>()

	let rank = 0
	let file = 0
	for (const ch of placement) {
		if (ch === "/") {
			rank += 1
			file = 0
			continue
		}
		if (ch >= "1" && ch <= "8") {
			file += Number(ch)
			continue
		}

		const isUpper = ch === ch.toUpperCase()
		if (isUpper === wantUpper) {
			const piece = ch.toLowerCase()
			if (piece === "p" || piece === "r" || piece === "q") {
				return true // a pawn, rook, or queen is always sufficient
			}
			if (piece === "n") {
				knights += 1
			} else if (piece === "b") {
				bishopSquareColours.add((rank + file) % 2)
			}
		}
		file += 1
	}

	const bishopColours = bishopSquareColours.size

	if (bishopColours >= 1 && knights >= 1) {
		return true // bishop + knight can force mate
	}
	if (bishopColours >= 2) {
		return true // bishops on both colours can mate
	}
	if (knights >= 3) {
		return true // three knights can mate
	}
	return false
}

export const chessVariant: VariantConfig = {
	gameType: "chess",
	boardRows: 8,
	boardCols: 8,
	teams: ["white", "black"],
	// Chess always opens with white
	appliesRedFirst: false,
	pveSupported: false,

	getInitialPosition() {
		return { fen: INITIAL_FEN_CHESS, firstTeam: "white" }
	},

	validateFen(fen) {
		const placement = fen.trim().split(/\s+/)[0]
		const ranks = placement.split("/")
		if (ranks.length !== 8) {
			return false
		}
		for (const rank of ranks) {
			let squares = 0
			for (const ch of rank) {
				if (ch >= "1" && ch <= "8") {
					squares += Number(ch)
				} else if ("prnbqkPRNBQK".includes(ch)) {
					squares += 1
				} else {
					return false
				}
			}
			if (squares !== 8) {
				return false
			}
		}
		return true
	},

	flagResolver(fen, winnerTeam) {
		return hasSufficientMatingMaterial(fen, winnerTeam)
	},

	// Standard FEN: uppercase = white, lowercase = black.
	formatCapturedPiece(piece, capturingTeam) {
		return capturingTeam === "white" ? piece.toLowerCase() : piece.toUpperCase()
	}
}
