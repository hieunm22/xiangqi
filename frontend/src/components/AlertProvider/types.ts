import { ConfirmProps as AlertOptions, EmptyVoid } from "types/Common"
export interface AlertQueueItem {
	id: number
	options: AlertOptions
	resolve: EmptyVoid
}

export type AlertHandler = (options: AlertOptions) => Promise<void>
