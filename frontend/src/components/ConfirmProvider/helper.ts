import { ConfirmOptions, InternalHandler } from "./types"

// Registered by ConfirmProvider on mount; kept separate from the component so
// `openConfirm` can be imported without breaking Fast Refresh.
let handler: InternalHandler | null = null

export function setConfirmHandler(next: InternalHandler | null) {
	handler = next
}

export function openConfirm(options: ConfirmOptions = {}): Promise<boolean> {
	if (!handler) return Promise.resolve(false)
	return handler(options)
}
