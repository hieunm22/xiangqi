export interface SnackbarOptions {
	avatar: string | null
	message: string
	duration?: number
	severity?: "success" | "error" | "warning" | "info"
}

export type SnackbarHandler = (options: SnackbarOptions) => void

export interface SnackbarQueueItem {
	id: number
	options: SnackbarOptions
}
