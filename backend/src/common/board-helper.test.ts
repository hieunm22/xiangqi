import { describe, expect, it } from "vitest"
import { hasPieceAcrossRiver } from "./board-helper"

// Reminder: in this project's FEN convention lowercase = red, uppercase = black.
describe("hasPieceAcrossRiver", () => {
	it("returns false at the initial position (no piece has crossed)", () => {
		const initial = "RHEAGAEHR/9/1C5C1/S1S1S1S1S/9/9/s1s1s1s1s/1c5c1/9/rheagaehr"
		expect(hasPieceAcrossRiver(initial, "red")).toBe(false)
		expect(hasPieceAcrossRiver(initial, "black")).toBe(false)
	})

	it("detects a red attacking piece that crossed into the top half", () => {
		// Red general on the bottom (home), a red chariot parked on row 0 (enemy half).
		const fen = "r8/9/9/9/9/9/9/9/9/4g4"
		expect(hasPieceAcrossRiver(fen, "red")).toBe(true)
	})

	it("detects a black attacking piece that crossed into the bottom half", () => {
		// Black general on top (home), a black chariot parked on row 9 (enemy half).
		const fen = "4G4/9/9/9/9/9/9/9/9/R8"
		expect(hasPieceAcrossRiver(fen, "black")).toBe(true)
	})

	it("returns false when only defensive pieces remain in the home half", () => {
		// Red general + advisor at the bottom, nothing across the river.
		const fen = "9/9/9/9/9/9/9/9/9/3ag4"
		expect(hasPieceAcrossRiver(fen, "red")).toBe(false)
	})

	it("falls back to winnable (true) when the team's general is missing", () => {
		const fen = "9/9/9/9/9/9/9/9/9/4g4"
		expect(hasPieceAcrossRiver(fen, "black")).toBe(true)
	})

	it("tolerates a full 6-field FEN by parsing the placement field only", () => {
		const initial = "RHEAGAEHR/9/1C5C1/S1S1S1S1S/9/9/s1s1s1s1s/1c5c1/9/rheagaehr w - - 0 1"
		expect(hasPieceAcrossRiver(initial, "red")).toBe(false)
		expect(hasPieceAcrossRiver(initial, "black")).toBe(false)
	})
})
