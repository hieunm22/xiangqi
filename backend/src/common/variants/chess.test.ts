import { describe, expect, it } from "vitest"
import { chessVariant, hasSufficientMatingMaterial } from "./chess"
import { getVariant, isGameType, isTeam, otherTeam } from "./index"
import { xiangqiVariant } from "./xiangqi"

// Chess FEN in this project stores only piece placement.
const placement = (rows: string) => rows

describe("hasSufficientMatingMaterial", () => {
	it("is sufficient with a queen / rook / pawn", () => {
		expect(hasSufficientMatingMaterial(placement("4k3/8/8/8/8/8/8/4K2Q"), "white")).toBe(true)
		expect(hasSufficientMatingMaterial(placement("4k3/8/8/8/8/8/8/R3K3"), "white")).toBe(true)
		expect(hasSufficientMatingMaterial(placement("4k3/8/8/8/8/8/4P3/4K3"), "white")).toBe(true)
	})

	it("is insufficient with a lone king", () => {
		expect(hasSufficientMatingMaterial(placement("4k3/8/8/8/8/8/8/4K3"), "white")).toBe(false)
	})

	it("is insufficient with king + single minor", () => {
		expect(hasSufficientMatingMaterial(placement("4k3/8/8/8/8/8/8/4KN2"), "white")).toBe(false)
		expect(hasSufficientMatingMaterial(placement("4k3/8/8/8/8/8/8/4KB2"), "white")).toBe(false)
	})

	it("is insufficient with king + two knights", () => {
		expect(hasSufficientMatingMaterial(placement("4k3/8/8/8/8/8/8/2N1KN2"), "white")).toBe(false)
	})

	it("is insufficient with bishops all on the same colour", () => {
		// Two bishops on light squares (a2, c4) - cannot mate.
		expect(hasSufficientMatingMaterial(placement("4k3/8/8/8/2B5/8/B7/4K3"), "white")).toBe(false)
	})

	it("is sufficient with bishop + knight", () => {
		expect(hasSufficientMatingMaterial(placement("4k3/8/8/8/8/8/8/3BKN2"), "white")).toBe(true)
	})

	it("is sufficient with bishops on both colours", () => {
		// b1 (dark) + c1 (light).
		expect(hasSufficientMatingMaterial(placement("4k3/8/8/8/8/8/8/1BB1K3"), "white")).toBe(true)
	})

	it("evaluates the requested side only (lowercase = black)", () => {
		const fen = placement("4k1q1/8/8/8/8/8/8/4K3")
		expect(hasSufficientMatingMaterial(fen, "black")).toBe(true)
		expect(hasSufficientMatingMaterial(fen, "white")).toBe(false)
	})
})

describe("chess variant config", () => {
	it("opens from the standard position with white to move, ignoring red_first", () => {
		expect(chessVariant.getInitialPosition(true)).toEqual(chessVariant.getInitialPosition(false))
		expect(chessVariant.getInitialPosition(true).firstTeam).toBe("white")
	})

	it("does not offer red-first or PvE", () => {
		expect(chessVariant.appliesRedFirst).toBe(false)
		expect(chessVariant.pveSupported).toBe(false)
	})
})

describe("variant registry", () => {
	it("resolves known types and falls back to xiangqi for unknown", () => {
		expect(getVariant("chess").gameType).toBe("chess")
		expect(getVariant("xiangqi").gameType).toBe("xiangqi")
		expect(getVariant("checkers").gameType).toBe("xiangqi")
		expect(getVariant(null).gameType).toBe("xiangqi")
	})

	it("isGameType guards correctly", () => {
		expect(isGameType("chess")).toBe(true)
		expect(isGameType("xiangqi")).toBe(true)
		expect(isGameType("go")).toBe(false)
	})
})

describe("team helpers", () => {
	it("isTeam accepts a variant's seats and rejects others", () => {
		expect(isTeam(chessVariant, "white")).toBe(true)
		expect(isTeam(chessVariant, "black")).toBe(true)
		expect(isTeam(chessVariant, "red")).toBe(false)
		expect(isTeam(xiangqiVariant, "red")).toBe(true)
		expect(isTeam(xiangqiVariant, "white")).toBe(false)
		expect(isTeam(chessVariant, null)).toBe(false)
	})

	it("otherTeam returns the opposing seat per variant", () => {
		expect(otherTeam(chessVariant, "white")).toBe("black")
		expect(otherTeam(chessVariant, "black")).toBe("white")
		expect(otherTeam(xiangqiVariant, "red")).toBe("black")
		expect(otherTeam(xiangqiVariant, "black")).toBe("red")
	})
})

describe("validateFen", () => {
	it("accepts each variant's initial position and rejects the other's", () => {
		const chessFen = chessVariant.getInitialPosition(true).fen
		const xiangqiFen = xiangqiVariant.getInitialPosition(true).fen
		expect(chessVariant.validateFen(chessFen)).toBe(true)
		expect(xiangqiVariant.validateFen(xiangqiFen)).toBe(true)
		expect(chessVariant.validateFen(xiangqiFen)).toBe(false)
		expect(xiangqiVariant.validateFen(chessFen)).toBe(false)
	})

	it("rejects a chess FEN with a wrong rank count or bad token", () => {
		expect(chessVariant.validateFen("8/8/8/8/8/8/8")).toBe(false)
		expect(chessVariant.validateFen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBXKBNR")).toBe(false)
	})
})

describe("formatCapturedPiece", () => {
	it("stores the captured piece in the opponent's case (chess)", () => {
		// White captures a black piece -> lowercase; black captures white -> uppercase.
		expect(chessVariant.formatCapturedPiece("N", "white")).toBe("n")
		expect(chessVariant.formatCapturedPiece("n", "black")).toBe("N")
	})

	it("stores the captured piece in the opponent's case (xiangqi)", () => {
		// Dialect: red is lowercase, black uppercase; captured piece is the opponent's.
		expect(xiangqiVariant.formatCapturedPiece("r", "red")).toBe("R")
		expect(xiangqiVariant.formatCapturedPiece("R", "black")).toBe("r")
	})
})
