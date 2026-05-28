import { describe, expect, it } from "vitest"
import { projectPieceToStandard, standardPieceToProject } from "./piece-map"

describe("piece-map", () => {
	describe("projectPieceToStandard", () => {
		it("converts red lowercase pieces to uppercase standard pieces", () => {
			expect(projectPieceToStandard("r")).toBe("R")
			expect(projectPieceToStandard("h")).toBe("N")
			expect(projectPieceToStandard("e")).toBe("B")
			expect(projectPieceToStandard("a")).toBe("A")
			expect(projectPieceToStandard("g")).toBe("K")
			expect(projectPieceToStandard("c")).toBe("C")
			expect(projectPieceToStandard("s")).toBe("P")
		})

		it("converts black uppercase pieces to lowercase standard pieces", () => {
			expect(projectPieceToStandard("R")).toBe("r")
			expect(projectPieceToStandard("H")).toBe("n")
			expect(projectPieceToStandard("E")).toBe("b")
			expect(projectPieceToStandard("A")).toBe("a")
			expect(projectPieceToStandard("G")).toBe("k")
			expect(projectPieceToStandard("C")).toBe("c")
			expect(projectPieceToStandard("S")).toBe("p")
		})

		it("throws on unknown characters", () => {
			expect(() => projectPieceToStandard("x")).toThrow()
			expect(() => projectPieceToStandard("1")).toThrow()
		})
	})

	describe("standardPieceToProject", () => {
		it("is the inverse of projectPieceToStandard for every piece", () => {
			const projectChars = ["r", "h", "e", "a", "g", "c", "s", "R", "H", "E", "A", "G", "C", "S"]
			for (const p of projectChars) {
				expect(standardPieceToProject(projectPieceToStandard(p))).toBe(p)
			}
		})
	})
})
