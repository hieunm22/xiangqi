export interface ReconcileOptions {
	autofix: boolean
	userIds: bigint[]
}

export interface PointMismatch {
	userId: string
	stored: number
	correct: number
	diff: number
}

export interface ReconcileResult {
	checked: number
	mismatches: PointMismatch[]
	fixed: number
}
