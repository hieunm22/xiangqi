import { describe, expect, it } from "vitest"
import {
	hasAttackingMaterial,
	hasPieceAcrossRiver,
	isSoldierAdvance,
	parseFenCounters,
	toStandardFen
} from "./board-helper"

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

// Reminder: in this project's FEN convention lowercase = red, uppercase = black.
describe("hasAttackingMaterial", () => {
	it("returns true at the initial position for both sides", () => {
		const initial = "RHEAGAEHR/9/1C5C1/S1S1S1S1S/9/9/s1s1s1s1s/1c5c1/9/rheagaehr"
		expect(hasAttackingMaterial(initial, "red")).toBe(true)
		expect(hasAttackingMaterial(initial, "black")).toBe(true)
	})

	it("returns false for a side holding only general/advisor/elephant", () => {
		// Red general + advisors + elephants at the bottom; no attacking piece.
		const fen = "9/9/9/9/9/9/9/9/9/2eagae2"
		expect(hasAttackingMaterial(fen, "red")).toBe(false)
	})

	it("returns false for BOTH sides in a dead-material position (the draw trigger)", () => {
		// Only generals + advisors remain on both sides -> nobody can ever checkmate.
		const fen = "3AGA3/9/9/9/9/9/9/9/9/3aga3"
		expect(hasAttackingMaterial(fen, "red")).toBe(false)
		expect(hasAttackingMaterial(fen, "black")).toBe(false)
	})

	it("detects each attacking piece type (chariot/horse/cannon/soldier)", () => {
		expect(hasAttackingMaterial("9/9/9/9/9/9/9/9/9/r8", "red")).toBe(true) // chariot
		expect(hasAttackingMaterial("9/9/9/9/9/9/9/9/9/h8", "red")).toBe(true) // horse
		expect(hasAttackingMaterial("9/9/9/9/9/9/9/9/9/c8", "red")).toBe(true) // cannon
		expect(hasAttackingMaterial("9/9/9/9/9/9/9/9/9/s8", "red")).toBe(true) // soldier
	})

	it("is per-team: a black attacker does not count as red material", () => {
		// A lone black cannon (uppercase) on the board.
		const fen = "9/9/2C6/9/9/9/9/9/9/9"
		expect(hasAttackingMaterial(fen, "black")).toBe(true)
		expect(hasAttackingMaterial(fen, "red")).toBe(false)
	})
})

// Reminder: lowercase = red, uppercase = black; row 0 is the top of the board.
describe("isSoldierAdvance", () => {
	it("detects a red soldier advancing forward (red home at the bottom)", () => {
		const prev = "4G4/9/9/9/9/9/s8/9/9/4g4"
		const next = "4G4/9/9/9/9/s8/9/9/9/4g4" // soldier row 6 -> row 5 (toward the enemy)
		expect(isSoldierAdvance(prev, next, "red")).toBe(true)
	})

	it("detects a black soldier advancing forward (black home at the top)", () => {
		const prev = "4G4/9/9/S8/9/9/9/9/9/4g4"
		const next = "4G4/9/9/9/S8/9/9/9/9/4g4" // soldier row 3 -> row 4 (toward the enemy)
		expect(isSoldierAdvance(prev, next, "black")).toBe(true)
	})

	it("returns false for a sideways soldier move (no forward progress)", () => {
		const prev = "4G4/9/9/s8/9/9/9/9/9/4g4"
		const next = "4G4/9/9/1s7/9/9/9/9/9/4g4" // soldier stays on row 3, shifts a column
		expect(isSoldierAdvance(prev, next, "red")).toBe(false)
	})

	it("returns false when a non-soldier piece moves", () => {
		const prev = "4G4/9/9/9/9/r8/9/9/9/4g4"
		const next = "4G4/9/9/9/r8/9/9/9/9/4g4" // a chariot moved, not a soldier
		expect(isSoldierAdvance(prev, next, "red")).toBe(false)
	})
})

const PLACEMENT = "RHEAGAEHR/9/1C5C1/S1S1S1S1S/9/9/s1s1s1s1s/1c5c1/9/rheagaehr"

describe("parseFenCounters", () => {
	it("defaults a board-only FEN to half-move 0, full-move 1", () => {
		expect(parseFenCounters(PLACEMENT)).toEqual({ halfmove: 0, fullmove: 1 })
	})

	it("reads the counters from a 6-field FEN", () => {
		expect(parseFenCounters(`${PLACEMENT} b - - 7 12`)).toEqual({ halfmove: 7, fullmove: 12 })
	})

	it("falls back to defaults when the counter fields are non-numeric", () => {
		expect(parseFenCounters(`${PLACEMENT} b - - x y`)).toEqual({ halfmove: 0, fullmove: 1 })
	})
})

describe("toStandardFen", () => {
	it("builds a 6-field FEN with the side to move and empty castling/en-passant", () => {
		expect(toStandardFen(PLACEMENT, "red", 0, 1)).toBe(`${PLACEMENT} w - - 0 1`)
		expect(toStandardFen(PLACEMENT, "black", 3, 5)).toBe(`${PLACEMENT} b - - 3 5`)
	})

	it("re-normalizes an already 6-field FEN using only its placement", () => {
		expect(toStandardFen(`${PLACEMENT} w - - 9 9`, "black", 1, 2)).toBe(`${PLACEMENT} b - - 1 2`)
	})
})
