import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { EndGameParams } from "types/game.type"

const transactionMock = vi.fn()
const gameUpdateManyMock = vi.fn()
const roomUpdateMock = vi.fn()
const gameUserUpdateManyMock = vi.fn()
const gameUserUpsertMock = vi.fn()
const gameUserFindManyMock = vi.fn()
const userUpdateMock = vi.fn()
const userUpdateManyMock = vi.fn()

// The interactive transaction receives this `tx` client and runs the callback.
const tx = {
	game: { updateMany: gameUpdateManyMock },
	room: { update: roomUpdateMock },
	gameUser: {
		updateMany: gameUserUpdateManyMock,
		upsert: gameUserUpsertMock,
		findMany: gameUserFindManyMock
	},
	user: { update: userUpdateMock, updateMany: userUpdateManyMock }
}

vi.mock("prisma", () => ({
	default: { $transaction: transactionMock }
}))

vi.mock("../helper", () => ({
	getUTCNow: () => new Date("2026-06-24T00:00:00.000Z")
}))

// Achievement awarding is a post-commit side effect covered by its own test;
// stub it so this suite doesn't reach Redis / the achievement catalog.
vi.mock("./achievement.helper", () => ({
	evaluateAchievements: vi.fn()
}))

// Imported dynamically in beforeAll so the vi.mock factories above (which close
// over the mock consts) are evaluated only after those consts are initialized.
let runEndGameTransaction: typeof import("./end-game.helper").runEndGameTransaction

const PVP_WIN: EndGameParams = {
	gameId: "game-1",
	roomId: BigInt(100),
	winnerId: BigInt(11),
	isBotGame: false,
	betAmount: 50,
	endReason: "checkmate"
}

describe("runEndGameTransaction", () => {
	beforeAll(async () => {
		;({ runEndGameTransaction } = await import("./end-game.helper"))
	})

	beforeEach(() => {
		transactionMock.mockImplementation(async (cb: (client: typeof tx) => unknown) => cb(tx))
	})

	it("claims the game only while it is not already finished (status != 2)", async () => {
		gameUpdateManyMock.mockResolvedValue({ count: 1 })
		gameUserFindManyMock.mockResolvedValue([{ user_id: BigInt(11) }, { user_id: BigInt(12) }])

		await runEndGameTransaction(PVP_WIN)

		expect(gameUpdateManyMock).toHaveBeenCalledWith({
			where: { id: "game-1", status: { not: 2 } },
			data: expect.objectContaining({ winner_id: BigInt(11), status: 2 })
		})
	})

	it("returns false and settles no points when another request already ended the game", async () => {
		// Lost the race: the conditional claim matched zero rows.
		gameUpdateManyMock.mockResolvedValue({ count: 0 })

		const result = await runEndGameTransaction(PVP_WIN)

		expect(result).toBe(false)
		expect(roomUpdateMock).not.toHaveBeenCalled()
		expect(gameUserUpsertMock).not.toHaveBeenCalled()
		expect(gameUserUpdateManyMock).not.toHaveBeenCalled()
		expect(userUpdateMock).not.toHaveBeenCalled()
		expect(userUpdateManyMock).not.toHaveBeenCalled()
	})

	it("settles PvP points once and returns true when it wins the claim", async () => {
		gameUpdateManyMock.mockResolvedValue({ count: 1 })
		gameUserFindManyMock.mockResolvedValue([{ user_id: BigInt(11) }, { user_id: BigInt(12) }])

		const result = await runEndGameTransaction(PVP_WIN)

		expect(result).toBe(true)
		expect(gameUserUpsertMock).toHaveBeenCalledWith(
			expect.objectContaining({
				where: { game_id_user_id: { game_id: "game-1", user_id: BigInt(11) } },
				update: { amount: 50 }
			})
		)
		expect(userUpdateMock).toHaveBeenCalledWith({
			where: { id: BigInt(11) },
			data: { total_amount: { increment: 50 } }
		})
		expect(gameUserUpdateManyMock).toHaveBeenCalledWith({
			where: { game_id: "game-1", user_id: { in: [BigInt(12)] } },
			data: { amount: -50 }
		})
		expect(userUpdateManyMock).toHaveBeenCalledWith({
			where: { id: { in: [BigInt(12)] } },
			data: { total_amount: { decrement: 50 } }
		})
	})

	it("does not touch loser points when the winner is the only participant", async () => {
		gameUpdateManyMock.mockResolvedValue({ count: 1 })
		gameUserFindManyMock.mockResolvedValue([{ user_id: BigInt(11) }])

		const result = await runEndGameTransaction(PVP_WIN)

		expect(result).toBe(true)
		expect(userUpdateMock).toHaveBeenCalledWith({
			where: { id: BigInt(11) },
			data: { total_amount: { increment: 50 } }
		})
		expect(gameUserUpdateManyMock).not.toHaveBeenCalled()
		expect(userUpdateManyMock).not.toHaveBeenCalled()
	})

	it("sets per-game point to 0 on a non-bot draw and leaves total_amount untouched", async () => {
		gameUpdateManyMock.mockResolvedValue({ count: 1 })

		const result = await runEndGameTransaction({
			gameId: "game-1",
			roomId: BigInt(100),
			winnerId: null,
			isBotGame: false,
			betAmount: 0,
			endReason: "draw"
		})

		expect(result).toBe(true)
		expect(gameUserUpdateManyMock).toHaveBeenCalledWith({
			where: { game_id: "game-1" },
			data: { amount: 0 }
		})
		expect(userUpdateMock).not.toHaveBeenCalled()
		expect(userUpdateManyMock).not.toHaveBeenCalled()
	})

	it("sets per-game point to null on a bot draw", async () => {
		gameUpdateManyMock.mockResolvedValue({ count: 1 })

		await runEndGameTransaction({
			gameId: "game-1",
			roomId: BigInt(100),
			winnerId: null,
			isBotGame: true,
			betAmount: 0,
			endReason: "draw"
		})

		expect(gameUserUpdateManyMock).toHaveBeenCalledWith({
			where: { game_id: "game-1" },
			data: { amount: null }
		})
	})

	it("does not settle points on a bot win but still ends the game", async () => {
		gameUpdateManyMock.mockResolvedValue({ count: 1 })

		const result = await runEndGameTransaction({
			gameId: "game-1",
			roomId: BigInt(100),
			winnerId: BigInt(11),
			isBotGame: true,
			betAmount: 100,
			endReason: "checkmate"
		})

		expect(result).toBe(true)
		expect(roomUpdateMock).toHaveBeenCalled()
		expect(gameUserUpsertMock).not.toHaveBeenCalled()
		expect(gameUserUpdateManyMock).not.toHaveBeenCalled()
		expect(userUpdateMock).not.toHaveBeenCalled()
		expect(userUpdateManyMock).not.toHaveBeenCalled()
	})
})
