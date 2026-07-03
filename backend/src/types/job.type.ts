export interface UserIdSelection {
	// Specific ids plus expanded closed ranges (e.g. "1, 4-6" -> [1, 4, 5, 6]).
	ids: bigint[]
	from?: bigint
}

export interface ReconcileOptions {
	autofix: boolean
	// Omit to reconcile every real user.
	selection?: UserIdSelection
}

export interface AmountMismatch {
	userId: string
	stored: number
	correct: number
	diff: number
}

export interface ReconcileResult {
	checked: number
	mismatches: AmountMismatch[]
	fixed: number
}
