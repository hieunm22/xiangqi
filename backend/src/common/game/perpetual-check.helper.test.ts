import { afterEach, describe, expect, it, vi } from "vitest"
import {
	PERPETUAL_CHECK_LOSS_REPETITION,
	PERPETUAL_CHECK_WARNING_REPETITION,
	evaluatePerpetualCheck,
	wouldCompletePerpetualLoss
} from "./perpetual-check.helper"
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

// Positions are (fen, team) where team is the side to move. "C"/"P*" are black-to-move
// checking positions; "O*" are the opponent's (red) replies.
const pos = (fen: string, team: Team) => ({ fen, team })

// `count` occurrences of a single black-to-move checking position "C", each separated
// by the opponent's reply "O": [C, O, C, O, ..., C].
const continuousChecks = (count: number): Array<{ fen: string; team: Team }> => {
	const positions: Array<{ fen: string; team: Team }> = []
	for (let i = 0; i < count; i += 1) {
		if (i > 0) positions.push(pos("O", "red"))
		positions.push(pos("C", "black"))
	}
	return positions
}

// `p1Count` occurrences of "P1" where the checking piece alternates P1/P2 each cycle:
// [P1, O1, P2, O2, P1, O1, P2, O2, ..., P1].
const alternatingChecks = (p1Count: number): Array<{ fen: string; team: Team }> => {
	const positions: Array<{ fen: string; team: Team }> = []
	for (let i = 0; i < p1Count; i += 1) {
		if (i > 0) positions.push(pos("O1", "red"), pos("P2", "black"), pos("O2", "red"))
		positions.push(pos("P1", "black"))
	}
	return positions
}

describe("evaluatePerpetualCheck", () => {
	afterEach(() => {
		vi.clearAllMocks()
	})

	it(`returns 'none' when the checking position has recurred fewer than ${PERPETUAL_CHECK_WARNING_REPETITION} times`, async () => {
		toArrayMock.mockResolvedValue(continuousChecks(PERPETUAL_CHECK_WARNING_REPETITION - 1))

		const result = await evaluatePerpetualCheck("game-1", "C", "black", true)

		expect(result).toMatchObject({
			status: "none",
			occurrencesCount: PERPETUAL_CHECK_WARNING_REPETITION - 1
		})
		// Below the warning threshold, so continuity is never evaluated.
		expect(evaluateTeamStateMock).not.toHaveBeenCalled()
	})

	it(`returns 'warning' on repetition ${PERPETUAL_CHECK_WARNING_REPETITION} of a continuous check`, async () => {
		toArrayMock.mockResolvedValue(continuousChecks(PERPETUAL_CHECK_WARNING_REPETITION))
		evaluateTeamStateMock.mockReturnValue({ inCheck: true, legalMovesCount: 1, status: "check" })

		const result = await evaluatePerpetualCheck("game-1", "C", "black", true)

		expect(result).toMatchObject({
			status: "warning",
			occurrencesCount: PERPETUAL_CHECK_WARNING_REPETITION
		})
	})

	it(`returns 'loss' on repetition ${PERPETUAL_CHECK_LOSS_REPETITION} of a continuous check`, async () => {
		toArrayMock.mockResolvedValue(continuousChecks(PERPETUAL_CHECK_LOSS_REPETITION))
		evaluateTeamStateMock.mockReturnValue({ inCheck: true, legalMovesCount: 1, status: "check" })

		const result = await evaluatePerpetualCheck("game-1", "C", "black", true)

		expect(result).toMatchObject({
			status: "loss",
			occurrencesCount: PERPETUAL_CHECK_LOSS_REPETITION
		})
	})

	it(`returns 'loss' for alternating pieces checking continuously (repetition ${PERPETUAL_CHECK_LOSS_REPETITION})`, async () => {
		toArrayMock.mockResolvedValue(alternatingChecks(PERPETUAL_CHECK_LOSS_REPETITION))
		evaluateTeamStateMock.mockReturnValue({ inCheck: true, legalMovesCount: 1, status: "check" })

		const result = await evaluatePerpetualCheck("game-1", "P1", "black", true)

		// P1 recurs LOSS times, even though the checking piece alternates P1/P2.
		expect(result).toMatchObject({
			status: "loss",
			occurrencesCount: PERPETUAL_CHECK_LOSS_REPETITION
		})
	})

	it("returns 'none' when a checked-side turn in the cycle is NOT a check (chain broken)", async () => {
		toArrayMock.mockResolvedValue(alternatingChecks(PERPETUAL_CHECK_WARNING_REPETITION))
		// P2 is not actually a check -> the checks are not continuous.
		evaluateTeamStateMock.mockImplementation((fen: string) => ({
			inCheck: fen === "P1",
			legalMovesCount: 1,
			status: fen === "P1" ? "check" : "ongoing"
		}))

		const result = await evaluatePerpetualCheck("game-1", "P1", "black", true)

		// P1 recurs enough to warn, but a P2 turn in the window is not a check, so the
		// continuity check fails and it is not ruled perpetual.
		expect(result).toMatchObject({
			status: "none",
			occurrencesCount: PERPETUAL_CHECK_WARNING_REPETITION
		})
	})
})

describe("wouldCompletePerpetualLoss", () => {
	afterEach(() => {
		vi.clearAllMocks()
	})

	it(`returns true when the pending check would be the losing repetition (${PERPETUAL_CHECK_LOSS_REPETITION})`, async () => {
		// History holds LOSS-1 continuous checks; playing the candidate makes it the LOSS-th.
		toArrayMock.mockResolvedValue(continuousChecks(PERPETUAL_CHECK_LOSS_REPETITION - 1))
		evaluateTeamStateMock.mockReturnValue({ inCheck: true, legalMovesCount: 1, status: "check" })

		const result = await wouldCompletePerpetualLoss("game-1", "C", "black", true)

		expect(result).toBe(true)
	})

	it(`returns false when the candidate would only be repetition ${PERPETUAL_CHECK_LOSS_REPETITION - 1} (below the loss threshold)`, async () => {
		toArrayMock.mockResolvedValue(continuousChecks(PERPETUAL_CHECK_LOSS_REPETITION - 2))
		evaluateTeamStateMock.mockReturnValue({ inCheck: true, legalMovesCount: 1, status: "check" })

		const result = await wouldCompletePerpetualLoss("game-1", "C", "black", true)

		expect(result).toBe(false)
	})

	it("returns false when the prior check chain is broken", async () => {
		// The candidate would be the LOSS-th occurrence, but a P2 turn in the window is not
		// a check, so the chain is broken and the loss must not be enforced.
		toArrayMock.mockResolvedValue(alternatingChecks(PERPETUAL_CHECK_LOSS_REPETITION - 1))
		evaluateTeamStateMock.mockImplementation((fen: string) => ({
			inCheck: fen === "P1",
			legalMovesCount: 1,
			status: fen === "P1" ? "check" : "ongoing"
		}))

		const result = await wouldCompletePerpetualLoss("game-1", "P1", "black", true)

		expect(result).toBe(false)
	})
})
