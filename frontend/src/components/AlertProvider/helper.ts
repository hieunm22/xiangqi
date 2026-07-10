import { ConfirmProps } from "types/Common"
import { AlertHandler } from "./types"

// The live handler is registered by AlertProvider on mount. Kept in this
// non-component module so `openAlert` can be imported without breaking the
// component file's Fast Refresh boundary.
let handler: AlertHandler | null = null

export function setAlertHandler(next: AlertHandler | null) {
	handler = next
}

export function openAlert(options: ConfirmProps) {
	if (!handler) return Promise.resolve()
	return handler(options)
}
