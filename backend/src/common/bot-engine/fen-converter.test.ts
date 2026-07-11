import { describe, expect, it } from "vitest"
import { INITIAL_FEN_BLACK_BOTTOM, INITIAL_FEN_BLACK_TOP } from "../constant"
import {
	flatArrayToProjectFen,
	projectFenToFlatArray,
	projectFenToStandardFen
} from "./fen-converter"

describe("fen-converter", () => {
	describe("projectFenToFlatArray ↔ flatArrayToProjectFen roundtrip", () => {
		it("survives BLACK_TOP starting position", () => {
			const cells = projectFenToFlatArray(INITIAL_FEN_BLACK_TOP)
			expect(cells).toHaveLength(90)
			expect(flatArrayToProjectFen(cells)).toBe(INITIAL_FEN_BLACK_TOP)
		})

		it("survives BLACK_BOTTOM starting position", () => {
			const cells = projectFenToFlatArray(INITIAL_FEN_BLACK_BOTTOM)
			expect(flatArrayToProjectFen(cells)).toBe(INITIAL_FEN_BLACK_BOTTOM)
		})

		it("tolerates a full 6-field FEN by parsing the placement field only", () => {
			const cells = projectFenToFlatArray(`${INITIAL_FEN_BLACK_TOP} w - - 0 1`)
			expect(cells).toHaveLength(90)
			expect(flatArrayToProjectFen(cells)).toBe(INITIAL_FEN_BLACK_TOP)
		})

		it("rejects FEN with wrong row count", () => {
			expect(() => projectFenToFlatArray("9/9/9")).toThrow()
		})

		it("rejects FEN with wrong column count in a row", () => {
			// 10 squares in row 0 instead of 9
			const bad = "rheagaehrr/9/9/9/9/9/9/9/9/9"
			expect(() => projectFenToFlatArray(bad)).toThrow()
		})
	})

	describe("projectFenToStandardFen", () => {
		// In INITIAL_FEN_BLACK_TOP, project lowercase=red sits at the bottom of the FEN
		// (already canonical layout). Conversion only swaps case + maps letters.
		it("converts BLACK_TOP starting position with red to move", () => {
			const standard = projectFenToStandardFen(INITIAL_FEN_BLACK_TOP, true, "red")
			expect(standard).toBe(
				"rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w - - 0 1"
			)
		})

		it("converts BLACK_TOP starting position with black to move", () => {
			const standard = projectFenToStandardFen(INITIAL_FEN_BLACK_TOP, true, "black")
			expect(standard.endsWith(" b - - 0 1")).toBe(true)
		})

		// BLACK_BOTTOM has red lowercase at the top of the FEN string; the function must
		// rotate 180° before translating so red ends up at the bottom in standard FEN.
		it("rotates BLACK_BOTTOM starting position so red ends up at the bottom of standard FEN", () => {
			const standard = projectFenToStandardFen(INITIAL_FEN_BLACK_BOTTOM, false, "red")
			expect(standard).toBe(
				"rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w - - 0 1"
			)
		})
	})
})
