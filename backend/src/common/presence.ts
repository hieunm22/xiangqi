import { PRESENCE_KEY, PRESENCE_STATUS_KEY } from "common/constant"
import redis from "common/redis"
import { UserPresenceStatus } from "types/game.type"

export type PresenceStatus = "online" | "busy" | "inactive" | "offline"

// A user is "online" while their heartbeat is fresh (a visible tab is actively
// pinging). Once pings stop (tab closed/hidden, socket dropped, network lost),
// the heartbeat ages: after ACTIVE_THRESHOLD they become "inactive" (away —
// shown with a clock badge), and after OFFLINE_THRESHOLD they drop off entirely.
export const PRESENCE_ACTIVE_THRESHOLD_MS = 2 * 60 * 1000	// 2 mins
export const PRESENCE_OFFLINE_THRESHOLD_MS = 5 * 60 * 1000	// 5 mins

// How often the sweeper re-derives state from heartbeat age to broadcast the
// online -> inactive -> offline transitions.
export const PRESENCE_SWEEP_INTERVAL_MS = 30 * 1000

// Grace after a user's last socket disconnects before they are forced inactive.
// Absorbs transient drops (page refresh, brief network loss) so they don't flip
// to "away" and back.
export const PRESENCE_DISCONNECT_GRACE_MS = 5 * 1000

// Presence lives in:
//   `presence-online` (sorted set) — member=userId, score=last heartbeat (ms).
//      Doubles as storage and the "who is present" index.
//   `presence-status` (hash)       — member=userId, value=last broadcast status.
//      Used only so the sweeper emits each transition once.

/**
 * Record a heartbeat for a user. Returns true when this heartbeat transitions
 * the user into the "online" state (from inactive/offline), so the caller can
 * broadcast it.
 */
export async function recordHeartbeat(userId: number): Promise<boolean> {
	const member = String(userId)

	const prevStatus = await redis.hget(PRESENCE_STATUS_KEY, member)
	await redis.zadd(PRESENCE_KEY, Date.now(), member)
	await redis.hset(PRESENCE_STATUS_KEY, member, "online")

	return prevStatus !== "online"
}

/**
 * Derive a user's status purely from their heartbeat age.
 */
export async function getStatus(userId: number): Promise<PresenceStatus> {
	const score = await redis.zscore(PRESENCE_KEY, String(userId))
	if (score === null) {
		return "offline"
	}

	const age = Date.now() - Number(score)
	if (age < PRESENCE_ACTIVE_THRESHOLD_MS) {
		return "online"
	}
	if (age < PRESENCE_OFFLINE_THRESHOLD_MS) {
		return "inactive"
	}
	return "offline"
}

/**
 * Whether a single user is currently online (actively heartbeating).
 */
export async function isOnline(userId: number): Promise<boolean> {
	return (await getStatus(userId)) === "online"
}

/**
 * Return every present user (online or inactive) with their current status.
 * Read-only: pruning and offline broadcasts are the sweeper's job, so this
 * never swallows an offline transition.
 */
export async function getActiveUserStatuses(): Promise<Array<UserPresenceStatus>> {
	const now = Date.now()
	const offlineCutoff = now - PRESENCE_OFFLINE_THRESHOLD_MS
	const activeCutoff = now - PRESENCE_ACTIVE_THRESHOLD_MS

	const flat = await redis.zrangebyscore(PRESENCE_KEY, offlineCutoff, "+inf", "WITHSCORES")

	const result: Array<UserPresenceStatus> = []
	for (let i = 0; i < flat.length; i += 2) {
		const userId = Number(flat[i])
		const score = Number(flat[i + 1])
		result.push({ userId, status: score >= activeCutoff ? "online" : "inactive" })
	}
	return result
}

/**
 * Explicitly drop a user from presence (e.g. on logout). Returns true when the
 * user was present beforehand, so the caller can broadcast the offline change.
 */
export async function markOffline(userId: number): Promise<boolean> {
	const member = String(userId)

	const score = await redis.zscore(PRESENCE_KEY, member)
	const wasPresent = score !== null && Number(score) >= Date.now() - PRESENCE_OFFLINE_THRESHOLD_MS

	await redis.zrem(PRESENCE_KEY, member)
	await redis.hdel(PRESENCE_STATUS_KEY, member)

	return wasPresent
}

/**
 * Force a currently-online user into "inactive" immediately — used when their
 * last socket/tab closes so they don't linger as online until the heartbeat
 * naturally ages out. Backdates the heartbeat to the active boundary so the
 * status derives as inactive for both live and freshly-loaded clients. They
 * still time out to offline via the sweeper. Returns true when a transition
 * happened (caller broadcasts); false if the user is absent or already
 * inactive/offline.
 */
export async function markInactive(userId: number): Promise<boolean> {
	const member = String(userId)

	const score = await redis.zscore(PRESENCE_KEY, member)
	if (score === null) {
		return false
	}
	if (Date.now() - Number(score) >= PRESENCE_ACTIVE_THRESHOLD_MS) {
		// Already inactive/offline by age — leave it to the sweeper.
		return false
	}

	await redis.zadd(PRESENCE_KEY, Date.now() - PRESENCE_ACTIVE_THRESHOLD_MS, member)
	await redis.hset(PRESENCE_STATUS_KEY, member, "inactive")

	return true
}

/**
 * Periodically re-derive presence from heartbeat age and report each user that
 * crossed a boundary via `emit`, exactly once per transition:
 *   - online -> inactive (heartbeat older than ACTIVE_THRESHOLD)
 *   - inactive/online -> offline (older than OFFLINE_THRESHOLD; also evicted)
 * The emitter is injected so this module stays free of any socket dependency.
 */
export function startPresenceSweeper(emit: (userId: number, status: PresenceStatus) => void) {
	const tick = async () => {
		try {
			const now = Date.now()
			const offlineCutoff = now - PRESENCE_OFFLINE_THRESHOLD_MS
			const activeCutoff = now - PRESENCE_ACTIVE_THRESHOLD_MS

			// Offline: heartbeat older than the offline threshold — evict + notify.
			const offlineMembers = await redis.zrangebyscore(PRESENCE_KEY, "-inf", `(${offlineCutoff}`)
			if (offlineMembers.length > 0) {
				await redis.zremrangebyscore(PRESENCE_KEY, "-inf", `(${offlineCutoff}`)
				await redis.hdel(PRESENCE_STATUS_KEY, ...offlineMembers)
				offlineMembers.forEach(member => emit(Number(member), "offline"))
			}

			// Inactive: heartbeat aged past the active threshold but still present.
			// Only notify those whose last broadcast status was not yet "inactive".
			const inactiveMembers = await redis.zrangebyscore(PRESENCE_KEY, offlineCutoff, `(${activeCutoff}`)
			for (const member of inactiveMembers) {
				const prevStatus = await redis.hget(PRESENCE_STATUS_KEY, member)
				if (prevStatus !== "inactive") {
					await redis.hset(PRESENCE_STATUS_KEY, member, "inactive")
					emit(Number(member), "inactive")
				}
			}
		} catch (error) {
			console.error("[Presence] Sweeper error:", error)
		}
	}

	const timer = setInterval(tick, PRESENCE_SWEEP_INTERVAL_MS)
	timer.unref?.()
	return timer
}
