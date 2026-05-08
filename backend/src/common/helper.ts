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
