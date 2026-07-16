import { ConfirmProps } from "types/Common"
import { AlertHandler } from "./types"

let handler: AlertHandler | null = null

export function setAlertHandler(next: AlertHandler | null) {
	handler = next
}

export function openAlert(options: ConfirmProps) {
	if (!handler) return Promise.resolve()
	return handler(options)
}
