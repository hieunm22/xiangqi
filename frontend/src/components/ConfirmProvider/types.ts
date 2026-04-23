export interface ConfirmOptions {
	title?: string
	message?: string
	disableBackdropClick?: boolean
}

export interface QueueProps {
	id: number
	options: ConfirmOptions
	resolve: (v: boolean) => void
}

export type InternalHandler = (opts: ConfirmOptions) => Promise<boolean>
