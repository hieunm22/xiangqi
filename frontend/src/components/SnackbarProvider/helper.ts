import { SnackbarHandler, SnackbarOptions } from "./types"

// Registered by SnackbarProvider on mount; kept separate from the component so
// `openSnackbar` can be imported without breaking Fast Refresh.
let handler: SnackbarHandler | null = null

export function setSnackbarHandler(next: SnackbarHandler | null) {
	handler = next
}

export function openSnackbar(options: SnackbarOptions) {
	if (!handler) return
	handler(options)
}
