import { createHash } from "crypto"

export function hashArrayOrderInvariant(arr: number[]): string {
	if (!arr || arr.length === 0) {
		return createHash("sha256").update("empty").digest("hex")
	}

	const sortedArr = [...arr].sort((a, b) => a - b)

	// convert to stable string
	const arrStr = sortedArr
		.map(x => x.toString())
		.join(",")

	// Hash by SHA-256
	return createHash("sha256")
		.update(arrStr, "utf8")
		.digest("hex")
}

export function getAvatarUrl(userId: number | bigint, avatarSeq: number): string {
	if (avatarSeq > 0) {
		return `/images/${userId}_${avatarSeq}.jpg`
	}
	return `/images/${userId}.jpg`
}

export function getUTCNow(): Date {
	const now = new Date()
	const utcNow = Date.UTC(
		now.getUTCFullYear(),
		now.getUTCMonth(),
		now.getUTCDate(),
		now.getUTCHours(),
		now.getUTCMinutes(),
		now.getUTCSeconds(),
		now.getUTCMilliseconds()
	)
	return new Date(utcNow)
}

export function getUTCTimestamp(): number {
	return Math.floor(getUTCNow().getTime() / 1000)
}

export function getConversationKey(userId1: number, userId2: number): string {
	const minId = Math.min(userId1, userId2)
	const maxId = Math.max(userId1, userId2)
	return `${minId}_${maxId}`
}
