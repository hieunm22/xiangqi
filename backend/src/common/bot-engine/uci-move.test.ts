import { describe, expect, it } from "vitest"
import { projectIndicesToUciMove, uciMoveToProjectIndices } from "./uci-move"

describe("uci-move", () => {
	describe("uciMoveToProjectIndices with redFirst=true (canonical layout)", () => {
		// Fairy-stockfish for xiangqi labels ranks 1-10 with rank 1 at the bottom
		// (red back rank). In project FEN with redFirst=true that same row sits at
		// the bottom (indices 81-89).
		it("maps a1 to project index 81 (bottom-left, red chariot)", () => {
			const { fromIdx } = uciMoveToProjectIndices("a1a2", true)
			expect(fromIdx).toBe(81)
		})

		it("maps a10 to project index 0 (top-left, black chariot)", () => {
			const { fromIdx } = uciMoveToProjectIndices("a10a8", true)
			expect(fromIdx).toBe(0)
		})

		it("maps the classic red cannon b3e3 → indices 64 → 67", () => {
			const { fromIdx, toIdx } = uciMoveToProjectIndices("b3e3", true)
			// rank 3 = row 7, file b = col 1 → idx 64; file e = col 4 → idx 67
			expect(fromIdx).toBe(64)
			expect(toIdx).toBe(67)
		})

		it("parses the engine's 5-char move a10a8 (rank 10 in from-square)", () => {
			const { fromIdx, toIdx } = uciMoveToProjectIndices("a10a8", true)
			expect(fromIdx).toBe(0)
			// rank 8 = row 2, file a = col 0 → idx 18
			expect(toIdx).toBe(18)
		})

		it("parses a 6-char move with rank 10 in both squares", () => {
			const { fromIdx, toIdx } = uciMoveToProjectIndices("a10i10", true)
			expect(fromIdx).toBe(0)
			expect(toIdx).toBe(8)
		})
	})

	describe("uciMoveToProjectIndices with redFirst=false (rotated layout)", () => {
		it("rotates a1 to project index 8 (top-right of rotated board)", () => {
			const { fromIdx } = uciMoveToProjectIndices("a1a2", false)
			// canonical 81 → rotated 89 - 81 = 8
			expect(fromIdx).toBe(8)
		})
	})

	describe("projectIndicesToUciMove roundtrip", () => {
		it.each([
			["a1a2", true],
			["b3e3", true],
			["a10a8", true],
			["a10i10", true],
			["i10b4", true],
			["a1a2", false],
			["a10a8", false]
		])("survives roundtrip for %s (redFirst=%s)", (uci, redFirst) => {
			const { fromIdx, toIdx } = uciMoveToProjectIndices(uci, redFirst as boolean)
			expect(projectIndicesToUciMove(fromIdx, toIdx, redFirst as boolean)).toBe(uci)
		})
	})

	describe("validation", () => {
		it("rejects malformed UCI strings", () => {
			expect(() => uciMoveToProjectIndices("xyz", true)).toThrow()
			expect(() => uciMoveToProjectIndices("z1a1", true)).toThrow()
			expect(() => uciMoveToProjectIndices("a0a1", true)).toThrow()
			expect(() => uciMoveToProjectIndices("a11a1", true)).toThrow()
		})
	})
})
