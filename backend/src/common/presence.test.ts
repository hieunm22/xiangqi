import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const {
	hdelMock,
	hgetMock,
	hsetMock,
	zaddMock,
	zrangebyscoreMock,
	zremMock,
	zremrangebyscoreMock,
	zscoreMock
} = vi.hoisted(() => ({
	hdelMock: vi.fn(),
	hgetMock: vi.fn(),
	hsetMock: vi.fn(),
	zaddMock: vi.fn(),
	zrangebyscoreMock: vi.fn(),
	zremMock: vi.fn(),
	zremrangebyscoreMock: vi.fn(),
	zscoreMock: vi.fn()
}))

vi.mock("./redis", () => ({
	default: {
		hdel: hdelMock,
		hget: hgetMock,
		hset: hsetMock,
		zadd: zaddMock,
		zrangebyscore: zrangebyscoreMock,
		zrem: zremMock,
		zremrangebyscore: zremrangebyscoreMock,
		zscore: zscoreMock
	}
}))

import { PRESENCE_KEY, PRESENCE_STATUS_KEY } from "./constant"
import {
	PRESENCE_ACTIVE_THRESHOLD_MS,
	PRESENCE_OFFLINE_THRESHOLD_MS,
	getActiveUserStatuses,
	getStatus,
	isOnline,
	markInactive,
	markOffline,
	recordHeartbeat,
	startPresenceSweeper
} from "./presence"

describe("presence", () => {
	const NOW = 1_700_000_000_000

	beforeEach(() => {
		vi.useFakeTimers()
		vi.setSystemTime(NOW)
	})

	afterEach(() => {
		vi.clearAllMocks()
		vi.useRealTimers()
	})

	describe("recordHeartbeat", () => {
		it("returns true and marks online when the user was not online (absent)", async () => {
			hgetMock.mockResolvedValue(null)

			const becameOnline = await recordHeartbeat(7)

			expect(becameOnline).toBe(true)
			expect(zaddMock).toHaveBeenCalledWith(PRESENCE_KEY, NOW, "7")
			expect(hsetMock).toHaveBeenCalledWith(PRESENCE_STATUS_KEY, "7", "online")
		})

		it("returns true when the user was previously inactive", async () => {
			hgetMock.mockResolvedValue("inactive")

			expect(await recordHeartbeat(7)).toBe(true)
		})

		it("returns false when the user was already online", async () => {
			hgetMock.mockResolvedValue("online")

			expect(await recordHeartbeat(7)).toBe(false)
			expect(zaddMock).toHaveBeenCalledWith(PRESENCE_KEY, NOW, "7")
		})
	})

	describe("getStatus", () => {
		it("returns offline when the user has no score", async () => {
			zscoreMock.mockResolvedValue(null)
			expect(await getStatus(9)).toBe("offline")
		})

		it("returns online when the heartbeat is within the active threshold", async () => {
			zscoreMock.mockResolvedValue(String(NOW - 1000))
			expect(await getStatus(9)).toBe("online")
		})

		it("returns inactive between the active and offline thresholds", async () => {
			zscoreMock.mockResolvedValue(String(NOW - PRESENCE_ACTIVE_THRESHOLD_MS - 1000))
			expect(await getStatus(9)).toBe("inactive")
		})

		it("returns offline past the offline threshold", async () => {
			zscoreMock.mockResolvedValue(String(NOW - PRESENCE_OFFLINE_THRESHOLD_MS - 1))
			expect(await getStatus(9)).toBe("offline")
		})
	})

	describe("isOnline", () => {
		it("is true only when status is online", async () => {
			zscoreMock.mockResolvedValue(String(NOW - 1000))
			expect(await isOnline(9)).toBe(true)

			zscoreMock.mockResolvedValue(String(NOW - PRESENCE_ACTIVE_THRESHOLD_MS - 1000))
			expect(await isOnline(9)).toBe(false)
		})
	})

	describe("getActiveUserStatuses", () => {
		it("maps present users to online/inactive by heartbeat age", async () => {
			zrangebyscoreMock.mockResolvedValue([
				"3", String(NOW - 1000),
				"5", String(NOW - PRESENCE_ACTIVE_THRESHOLD_MS - 1000)
			])

			const result = await getActiveUserStatuses()

			const offlineCutoff = NOW - PRESENCE_OFFLINE_THRESHOLD_MS
			expect(zrangebyscoreMock).toHaveBeenCalledWith(PRESENCE_KEY, offlineCutoff, "+inf", "WITHSCORES")
			expect(result).toEqual([
				{ userId: 3, status: "online" },
				{ userId: 5, status: "inactive" }
			])
		})
	})

	describe("markOffline", () => {
		it("removes the user and reports they were present", async () => {
			zscoreMock.mockResolvedValue(String(NOW - 1000))

			expect(await markOffline(4)).toBe(true)
			expect(zremMock).toHaveBeenCalledWith(PRESENCE_KEY, "4")
			expect(hdelMock).toHaveBeenCalledWith(PRESENCE_STATUS_KEY, "4")
		})

		it("still cleans up but reports not-present when stale", async () => {
			zscoreMock.mockResolvedValue(String(NOW - PRESENCE_OFFLINE_THRESHOLD_MS - 1))

			expect(await markOffline(4)).toBe(false)
			expect(zremMock).toHaveBeenCalledWith(PRESENCE_KEY, "4")
		})
	})

	describe("markInactive", () => {
		it("backdates an online user to the active boundary and marks inactive", async () => {
			zscoreMock.mockResolvedValue(String(NOW - 1000))

			expect(await markInactive(4)).toBe(true)
			expect(zaddMock).toHaveBeenCalledWith(PRESENCE_KEY, NOW - PRESENCE_ACTIVE_THRESHOLD_MS, "4")
			expect(hsetMock).toHaveBeenCalledWith(PRESENCE_STATUS_KEY, "4", "inactive")
		})

		it("returns false and does nothing when the user is absent", async () => {
			zscoreMock.mockResolvedValue(null)

			expect(await markInactive(4)).toBe(false)
			expect(zaddMock).not.toHaveBeenCalled()
		})

		it("returns false when the user is already past the active threshold", async () => {
			zscoreMock.mockResolvedValue(String(NOW - PRESENCE_ACTIVE_THRESHOLD_MS - 1000))

			expect(await markInactive(4)).toBe(false)
			expect(zaddMock).not.toHaveBeenCalled()
		})
	})

	describe("startPresenceSweeper", () => {
		it("evicts offline users and demotes aged users to inactive once", async () => {
			// 1st zrangebyscore call -> offline band; 2nd -> inactive band
			zrangebyscoreMock
				.mockResolvedValueOnce(["20"])
				.mockResolvedValueOnce(["12", "15"])
			// neither inactive member has been notified yet
			hgetMock.mockResolvedValue(null)
			const emit = vi.fn()

			startPresenceSweeper(emit)
			await vi.advanceTimersByTimeAsync(30 * 1000)

			expect(zremrangebyscoreMock).toHaveBeenCalled()
			expect(hdelMock).toHaveBeenCalledWith(PRESENCE_STATUS_KEY, "20")
			expect(emit).toHaveBeenCalledWith(20, "offline")
			expect(emit).toHaveBeenCalledWith(12, "inactive")
			expect(emit).toHaveBeenCalledWith(15, "inactive")
			expect(hsetMock).toHaveBeenCalledWith(PRESENCE_STATUS_KEY, "12", "inactive")
		})

		it("does not re-emit inactive for users already marked inactive", async () => {
			zrangebyscoreMock
				.mockResolvedValueOnce([])      // no offline
				.mockResolvedValueOnce(["12"])  // one inactive-band member
			hgetMock.mockResolvedValue("inactive")
			const emit = vi.fn()

			startPresenceSweeper(emit)
			await vi.advanceTimersByTimeAsync(30 * 1000)

			expect(emit).not.toHaveBeenCalled()
		})
	})
})
