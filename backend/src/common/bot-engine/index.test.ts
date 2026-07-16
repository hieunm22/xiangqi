import { beforeEach, describe, expect, it, vi } from "vitest"

const { findBestMoveMock, findBestMovesMock, getEngineForGameMock } = vi.hoisted(() => ({
	findBestMoveMock: vi.fn(),
	findBestMovesMock: vi.fn(),
	getEngineForGameMock: vi.fn()
}))

vi.mock("./manager", () => ({
	engineManager: { getEngineForGame: getEngineForGameMock }
}))
vi.mock("./difficulty", () => ({
	getDifficultyConfig: vi.fn().mockReturnValue({ skillLevel: 1, depth: 1, movetimeMs: 1, label: "test" }),
	isValidDifficulty: vi.fn()
}))
vi.mock("./fen-converter", () => ({ projectFenToStandardFen: vi.fn().mockReturnValue("std-fen") }))
vi.mock("./uci-move", () => ({ uciMoveToProjectIndices: vi.fn().mockReturnValue({ fromIdx: 0, toIdx: 1 }) }))
// buildResult keeps the candidate's uci; newFen is irrelevant to these tests, so a
// constant keeps each candidate distinguishable by its uci alone.
vi.mock("./move-applier", () => ({
	applyMoveToProjectFen: vi.fn().mockReturnValue({ newFen: "new-fen", capturePiece: null })
}))

import { requestBotMove } from "./index"

const PARAMS = {
	gameId: "g1",
	projectFen: "pf",
	redFirst: true,
	botTeam: "red" as const,
	difficulty: 1
}

describe("requestBotMove perpetual-check avoidance", () => {
	beforeEach(() => {
		vi.clearAllMocks()
		getEngineForGameMock.mockResolvedValue({
			findBestMove: findBestMoveMock,
			findBestMoves: findBestMovesMock
		})
	})

	it("returns the engine's top move when there is no reject predicate", async () => {
		findBestMoveMock.mockResolvedValue("h3e3")

		const result = await requestBotMove(PARAMS)

		expect(result).toEqual({ uci: "h3e3", newFen: "new-fen", capturePiece: null })
		expect(findBestMovesMock).not.toHaveBeenCalled()
	})

	it("returns null when the engine has no legal moves", async () => {
		findBestMoveMock.mockResolvedValue(null)

		const result = await requestBotMove(PARAMS, { rejectMove: () => true })

		expect(result).toBeNull()
		expect(findBestMovesMock).not.toHaveBeenCalled()
	})

	it("keeps the top move when it is accepted (no fallback search)", async () => {
		findBestMoveMock.mockResolvedValue("h3e3")

		const result = await requestBotMove(PARAMS, { rejectMove: () => false })

		expect(result?.uci).toBe("h3e3")
		expect(findBestMovesMock).not.toHaveBeenCalled()
	})

	it("falls back to the highest-ranked accepted alternative when the top move is rejected", async () => {
		findBestMoveMock.mockResolvedValue("aaa")
		findBestMovesMock.mockResolvedValue(["aaa", "bbb", "ccc"])

		const result = await requestBotMove(PARAMS, {
			rejectMove: candidate => candidate.uci === "aaa"
		})

		expect(result?.uci).toBe("bbb")
	})

	it("plays the top move anyway when every candidate is rejected (forced position)", async () => {
		findBestMoveMock.mockResolvedValue("aaa")
		findBestMovesMock.mockResolvedValue(["aaa", "bbb"])

		const result = await requestBotMove(PARAMS, { rejectMove: () => true })

		expect(result?.uci).toBe("aaa")
	})
})
