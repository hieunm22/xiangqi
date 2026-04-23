import { ConfirmProps as AlertOptions } from "types/Common"
export interface AlertQueueItem {
	id: number
	options: AlertOptions
	resolve: () => void
}

export type AlertHandler = (options: AlertOptions) => Promise<void>
