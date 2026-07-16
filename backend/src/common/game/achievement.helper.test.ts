import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi
} from "vitest"

// getCachedAchievements uses the global prisma+Redis (not the tx client).
// vi.hoisted makes these mocks available inside vi.mock factories.
const { achievementFindManyMock, redisGetMock, redisSetMock } = vi.hoisted(() => ({
	achievementFindManyMock: vi.fn(),
	redisGetMock: vi.fn(),
	redisSetMock: vi.fn()
}))

vi.mock("prisma", () => ({
	default: {
		achievement: {
			findMany: achievementFindManyMock
		}
	}
}))

vi.mock("../redis", () => ({
	default: {
		get: redisGetMock,
		set: redisSetMock
	}
}))

import { evaluateAchievements } from "./achievement.helper"

// Achievement catalog rows as the DB would return them.
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
}) => {
	const createManyMock = vi.fn().mockResolvedValue({ count: 0 })
	const countMock = vi.fn().mockImplementation(({ where }: { where: { amount: unknown } }) => {
		if (typeof where.amount === "object") {
			return Promise.resolve(options.winCount)
		}
		return Promise.resolve(options.drawCount)
	})

	const tx = {
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
	beforeEach(() => {
		// Cache miss by default, so the catalog is read from the (mocked) DB.
		redisGetMock.mockResolvedValue(null)
		achievementFindManyMock.mockResolvedValue(DB_ACHIEVEMENTS)
	})

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
		achievementFindManyMock.mockResolvedValue([])

		const { tx, createManyMock } = buildTx({
			participants: [{ user_id: 10n, is_bot: false }],
			winCount: 5,
			drawCount: 60
		})

		await evaluateAchievements(tx as never, "game-1")

		expect(createManyMock).not.toHaveBeenCalled()
	})

	it("awards the no-legal-moves achievement to the stalemate winner", async () => {
		achievementFindManyMock.mockResolvedValue([
			...DB_ACHIEVEMENTS,
			{ id: 4n, name: "achievement.title-03" }
		])
		const { tx, createManyMock } = buildTx({
			participants: [{ user_id: 10n, is_bot: false }],
			winCount: 1,
			drawCount: 0
		})

		await evaluateAchievements(tx as never, "game-1", { endReason: "stalemate", winnerId: 10n })

		expect(createManyMock).toHaveBeenCalledWith({
			data: [
				{ user_id: 10n, achievement_id: 1n },
				{ user_id: 10n, achievement_id: 4n }
			],
			skipDuplicates: true
		})
	})

	it("does not award no-legal-moves when the game did not end in stalemate", async () => {
		achievementFindManyMock.mockResolvedValue([
			...DB_ACHIEVEMENTS,
			{ id: 4n, name: "achievement.title-03" }
		])
		const { tx, createManyMock } = buildTx({
			participants: [{ user_id: 10n, is_bot: false }],
			winCount: 1,
			drawCount: 0
		})

		await evaluateAchievements(tx as never, "game-1", { endReason: "checkmate", winnerId: 10n })

		expect(createManyMock).toHaveBeenCalledWith({
			data: [{ user_id: 10n, achievement_id: 1n }],
			skipDuplicates: true
		})
	})

	it("serves the catalog from the Redis cache without querying the DB", async () => {
		redisGetMock.mockResolvedValue(JSON.stringify([
			{ id: "1", name: "achievement.title-02" }
		]))

		const { tx, createManyMock } = buildTx({
			participants: [{ user_id: 10n, is_bot: false }],
			winCount: 1,
			drawCount: 0
		})

		await evaluateAchievements(tx as never, "game-1")

		expect(achievementFindManyMock).not.toHaveBeenCalled()
		expect(createManyMock).toHaveBeenCalledWith({
			data: [{ user_id: 10n, achievement_id: 1n }],
			skipDuplicates: true
		})
	})
})
