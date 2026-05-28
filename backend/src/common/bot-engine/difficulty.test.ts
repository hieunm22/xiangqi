import { describe, expect, it } from "vitest"
import { BotDifficulty } from "../enums"
import { getDifficultyConfig, isValidDifficulty } from "./difficulty"

const LABELS: Record<BotDifficulty, string> = {
	[BotDifficulty.BEGINNER]: "beginner",
	[BotDifficulty.AMATEUR]: "amateur",
	[BotDifficulty.INTERMEDIATE]: "intermediate",
	[BotDifficulty.ADVANCED]: "advanced",
	[BotDifficulty.MASTER]: "master"
}

describe("difficulty", () => {
	it("enum exposes the 5 expected tiers in ascending order", () => {
		expect(BotDifficulty.BEGINNER).toBe(1)
		expect(BotDifficulty.AMATEUR).toBe(2)
		expect(BotDifficulty.INTERMEDIATE).toBe(3)
		expect(BotDifficulty.ADVANCED).toBe(4)
		expect(BotDifficulty.MASTER).toBe(5)
	})

	it("returns a config for every level from 1 to 5 with the expected label", () => {
		for (let level = 1; level <= 5; level += 1) {
			const config = getDifficultyConfig(level)
			expect(config.skillLevel).toBeGreaterThanOrEqual(0)
			expect(config.skillLevel).toBeLessThanOrEqual(20)
			expect(config.depth).toBeGreaterThan(0)
			expect(config.movetimeMs).toBeGreaterThan(0)
			expect(config.label).toBe(LABELS[level as BotDifficulty])
		}
	})

	it("strictly increases depth and movetime across levels", () => {
		let prevDepth = -Infinity
		let prevMovetime = -Infinity
		for (let level = 1; level <= 5; level += 1) {
			const c = getDifficultyConfig(level)
			expect(c.depth).toBeGreaterThanOrEqual(prevDepth)
			expect(c.movetimeMs).toBeGreaterThan(prevMovetime)
			prevDepth = c.depth
			prevMovetime = c.movetimeMs
		}
	})

	it("rejects out-of-range levels", () => {
		expect(() => getDifficultyConfig(0)).toThrow()
		expect(() => getDifficultyConfig(6)).toThrow()
		expect(() => getDifficultyConfig(-1)).toThrow()
		expect(() => getDifficultyConfig(1.5)).toThrow()
	})

	describe("isValidDifficulty", () => {
		it("accepts integers 1..5", () => {
			for (let level = 1; level <= 5; level += 1) {
				expect(isValidDifficulty(level)).toBe(true)
			}
		})

		it("rejects out-of-range or non-integer numbers", () => {
			expect(isValidDifficulty(0)).toBe(false)
			expect(isValidDifficulty(6)).toBe(false)
			expect(isValidDifficulty(1.5)).toBe(false)
			expect(isValidDifficulty(Number.NaN)).toBe(false)
		})
	})
})
