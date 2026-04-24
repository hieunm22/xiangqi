import { EmptyVoid } from "types/Common"

export interface ConfirmOptions {
	title?: string
	message?: string
	disableBackdropClick?: boolean
	onOk?: EmptyVoid
}

export interface QueueProps {
	id: number
	options: ConfirmOptions
	resolve: (v: boolean) => void
}

export type InternalHandler = (opts: ConfirmOptions) => Promise<boolean>
