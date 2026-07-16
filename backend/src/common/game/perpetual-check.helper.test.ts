import { afterEach, describe, expect, it, vi } from "vitest"
import { Team } from "types/game.type"

const { toArrayMock, evaluateTeamStateMock } = vi.hoisted(() => ({
	toArrayMock: vi.fn(),
	evaluateTeamStateMock: vi.fn()
}))

vi.mock("common/mongodb", () => ({
	getGameHistoryCollection: vi.fn().mockResolvedValue({
		find: () => ({
			sort: () => ({ toArray: toArrayMock })
		})
	})
}))

vi.mock("./state-evaluator", () => ({
	evaluateTeamState: evaluateTeamStateMock
}))

import { evaluatePerpetualCheck, wouldCompletePerpetualLoss } from "./perpetual-check.helper"

// Positions are (fen, team) where team is the side to move. "C"/"P*" are black-to-move
// checking positions; "O*" are the opponent's (red) replies.
const pos = (fen: string, team: Team) => ({ fen, team })

describe("evaluatePerpetualCheck", () => {
	afterEach(() => {
		vi.clearAllMocks()
	})

	it("returns 'none' when the checking position has recurred fewer than 3 times", async () => {
		toArrayMock.mockResolvedValue([pos("C", "black"), pos("O", "red")])

		const result = await evaluatePerpetualCheck("game-1", "C", "black", true)

		expect(result).toMatchObject({ status: "none", occurrencesCount: 1 })
		// Below the warning threshold, so continuity is never evaluated.
		expect(evaluateTeamStateMock).not.toHaveBeenCalled()
	})

	it("returns 'warning' on the 3rd repetition of a continuous check", async () => {
		toArrayMock.mockResolvedValue([
			pos("C", "black"), pos("O", "red"),
			pos("C", "black"), pos("O", "red"),
			pos("C", "black")
		])
		evaluateTeamStateMock.mockReturnValue({ inCheck: true, legalMovesCount: 1, status: "check" })

		const result = await evaluatePerpetualCheck("game-1", "C", "black", true)

		expect(result).toMatchObject({ status: "warning", occurrencesCount: 3 })
	})

	it("returns 'loss' on the 4th repetition of a continuous check", async () => {
		toArrayMock.mockResolvedValue([
			pos("C", "black"), pos("O", "red"),
			pos("C", "black"), pos("O", "red"),
			pos("C", "black"), pos("O", "red"),
			pos("C", "black")
		])
		evaluateTeamStateMock.mockReturnValue({ inCheck: true, legalMovesCount: 1, status: "check" })

		const result = await evaluatePerpetualCheck("game-1", "C", "black", true)

		expect(result).toMatchObject({ status: "loss", occurrencesCount: 4 })
	})

	it("returns 'loss' for alternating pieces checking continuously (4th repetition)", async () => {
		toArrayMock.mockResolvedValue([
			pos("P1", "black"), pos("O1", "red"), pos("P2", "black"), pos("O2", "red"),
			pos("P1", "black"), pos("O1", "red"), pos("P2", "black"), pos("O2", "red"),
			pos("P1", "black"), pos("O1", "red"), pos("P2", "black"), pos("O2", "red"),
			pos("P1", "black")
		])
		evaluateTeamStateMock.mockReturnValue({ inCheck: true, legalMovesCount: 1, status: "check" })

		const result = await evaluatePerpetualCheck("game-1", "P1", "black", true)

		// P1 recurs 4 times (loss), even though the checking piece alternates P1/P2.
		expect(result).toMatchObject({ status: "loss", occurrencesCount: 4 })
	})

	it("returns 'none' when a checked-side turn in the cycle is NOT a check (chain broken)", async () => {
		toArrayMock.mockResolvedValue([
			pos("P1", "black"), pos("O1", "red"), pos("P2", "black"), pos("O2", "red"),
			pos("P1", "black"), pos("O1", "red"), pos("P2", "black"), pos("O2", "red"),
			pos("P1", "black")
		])
		// P2 is not actually a check -> the checks are not continuous.
		evaluateTeamStateMock.mockImplementation((fen: string) => ({
			inCheck: fen === "P1",
			legalMovesCount: 1,
			status: fen === "P1" ? "check" : "ongoing"
		}))

		const result = await evaluatePerpetualCheck("game-1", "P1", "black", true)

		// P1 recurs 3 times, but a P2 turn in the window is not a check, so the
		// continuity check fails and it is not ruled perpetual.
		expect(result).toMatchObject({ status: "none", occurrencesCount: 3 })
	})
})

describe("wouldCompletePerpetualLoss", () => {
	afterEach(() => {
		vi.clearAllMocks()
	})

	it("returns true when the pending check would be the losing (4th) repetition", async () => {
		// History holds 3 continuous checks; playing the candidate makes it the 4th.
		toArrayMock.mockResolvedValue([
			pos("C", "black"), pos("O", "red"),
			pos("C", "black"), pos("O", "red"),
			pos("C", "black")
		])
		evaluateTeamStateMock.mockReturnValue({ inCheck: true, legalMovesCount: 1, status: "check" })

		const result = await wouldCompletePerpetualLoss("game-1", "C", "black", true)

		expect(result).toBe(true)
	})

	it("returns false when only 2 prior checks exist (candidate would be the 3rd)", async () => {
		toArrayMock.mockResolvedValue([
			pos("C", "black"), pos("O", "red"),
			pos("C", "black")
		])
		evaluateTeamStateMock.mockReturnValue({ inCheck: true, legalMovesCount: 1, status: "check" })

		const result = await wouldCompletePerpetualLoss("game-1", "C", "black", true)

		expect(result).toBe(false)
	})

	it("returns false when the prior check chain is broken", async () => {
		// Candidate P1 would be the 4th occurrence, but a P2 turn in the window is not a
		// check, so the chain is broken and the loss must not be enforced.
		toArrayMock.mockResolvedValue([
			pos("P1", "black"), pos("O1", "red"), pos("P2", "black"), pos("O2", "red"),
			pos("P1", "black"), pos("O1", "red"), pos("P2", "black"), pos("O2", "red"),
			pos("P1", "black")
		])
		evaluateTeamStateMock.mockImplementation((fen: string) => ({
			inCheck: fen === "P1",
			legalMovesCount: 1,
			status: fen === "P1" ? "check" : "ongoing"
		}))

		const result = await wouldCompletePerpetualLoss("game-1", "P1", "black", true)

		expect(result).toBe(false)
	})
})
