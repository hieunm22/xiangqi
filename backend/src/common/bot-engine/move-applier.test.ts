import { describe, expect, it } from "vitest"
import { INITIAL_FEN_BLACK_TOP } from "../constant"
import { applyMoveToProjectFen } from "./move-applier"
import { projectFenToFlatArray } from "./fen-converter"

describe("applyMoveToProjectFen", () => {
	it("moves a piece to an empty square (no capture)", () => {
		// BLACK_TOP starting pos. Red soldier at row 6, col 0 → idx 54.
		// Move it forward one row → idx 45.
		const { newFen, capturePiece } = applyMoveToProjectFen(INITIAL_FEN_BLACK_TOP, 54, 45)
		expect(capturePiece).toBeNull()
		const cells = projectFenToFlatArray(newFen)
		expect(cells[54]).toBeNull()
		expect(cells[45]).toBe("s")
	})

	it("captures the piece on the destination square", () => {
		// Fabricate a FEN where red soldier (s) at idx 45 can capture a black soldier (S) at idx 36.
		const start = "9/9/9/9/S8/s8/9/9/9/9"
		// idx 45 = row 5, col 0 = 's' (red). idx 36 = row 4, col 0 = 'S' (black).
		const { newFen, capturePiece } = applyMoveToProjectFen(start, 45, 36)
		expect(capturePiece).toBe("S")
		expect(newFen).toBe("9/9/9/9/s8/9/9/9/9/9")
	})

	it("throws when fromIdx is empty", () => {
		expect(() => applyMoveToProjectFen(INITIAL_FEN_BLACK_TOP, 40, 39)).toThrow()
	})
})
