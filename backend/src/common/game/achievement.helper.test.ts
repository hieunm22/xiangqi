import { afterEach, describe, expect, it, vi } from "vitest"
import { evaluateAchievements } from "./achievement.helper"

// Mock of the achievement rows present in the DB, returned by tx.achievement.findMany.
// evaluateAchievements maps these name -> id to decide which rows to award.
const DB_ACHIEVEMENTS = [
	{ id: 1n, name: "achievement.title-02" },
	{ id: 2n, name: "achievement.title-06" },
	{ id: 3n, name: "achievement.title-07" }
]

// Build a mock transaction client whose gameUser.count answers based on the
// amount filter (win: { gt: 0 }, draw: 0).
const buildTx = (options: {
	participants: { user_id: bigint; is_bot: boolean }[]
	winCount: number
	drawCount: number
	achievements?: { id: bigint; name: string }[]
}) => {
	const createManyMock = vi.fn().mockResolvedValue({ count: 0 })
	const countMock = vi.fn().mockImplementation(({ where }: { where: { amount: unknown } }) => {
		if (typeof where.amount === "object") {
			return Promise.resolve(options.winCount)
		}
		return Promise.resolve(options.drawCount)
	})

	const tx = {
		achievement: {
			findMany: vi.fn().mockResolvedValue(options.achievements ?? DB_ACHIEVEMENTS)
		},
		gameUser: {
			findMany: vi.fn().mockResolvedValue(
				options.participants.map(participant => ({
					user_id: participant.user_id,
					users: { is_bot: participant.is_bot }
				}))
			),
			count: countMock
		},
		userAchievement: {
			createMany: createManyMock
		}
	}

	return { tx, createManyMock, countMock }
}

describe("evaluateAchievements", () => {
	afterEach(() => {
		vi.clearAllMocks()
	})

	it("awards the first-win achievement when the user has at least one win", async () => {
		const { tx, createManyMock } = buildTx({
			participants: [{ user_id: 10n, is_bot: false }],
			winCount: 1,
			drawCount: 0
		})

		await evaluateAchievements(tx as never, "game-1")

		expect(createManyMock).toHaveBeenCalledWith({
			data: [{ user_id: 10n, achievement_id: 1n }],
			skipDuplicates: true
		})
	})

	it("awards first-win and 100-wins together at the 100th win", async () => {
		const { tx, createManyMock } = buildTx({
			participants: [{ user_id: 10n, is_bot: false }],
			winCount: 100,
			drawCount: 0
		})

		await evaluateAchievements(tx as never, "game-1")

		expect(createManyMock).toHaveBeenCalledWith({
			data: [
				{ user_id: 10n, achievement_id: 1n },
				{ user_id: 10n, achievement_id: 2n }
			],
			skipDuplicates: true
		})
	})

	it("awards the 50-draws achievement at the 50th draw", async () => {
		const { tx, createManyMock } = buildTx({
			participants: [{ user_id: 10n, is_bot: false }],
			winCount: 0,
			drawCount: 50
		})

		await evaluateAchievements(tx as never, "game-1")

		expect(createManyMock).toHaveBeenCalledWith({
			data: [{ user_id: 10n, achievement_id: 3n }],
			skipDuplicates: true
		})
	})

	it("skips bot participants", async () => {
		const { tx, createManyMock } = buildTx({
			participants: [{ user_id: 99n, is_bot: true }],
			winCount: 5,
			drawCount: 0
		})

		await evaluateAchievements(tx as never, "game-1")

		expect(createManyMock).not.toHaveBeenCalled()
	})

	it("does nothing when no achievements exist in the database", async () => {
		const { tx, createManyMock } = buildTx({
			participants: [{ user_id: 10n, is_bot: false }],
			winCount: 5,
			drawCount: 60,
			achievements: []
		})

		await evaluateAchievements(tx as never, "game-1")

		expect(createManyMock).not.toHaveBeenCalled()
	})
})
