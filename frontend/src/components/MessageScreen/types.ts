import { EmptyVoid } from "types/Common"

export interface MessageScreenProps {
	message: string
	data?: string[]
	actionMessage?: string
	action?: EmptyVoid
	icon: MessageScreenIcon
}

export type MessageScreenIcon =
	| "fa-circle-exclamation fail"
	| "fa-check-circle success"
	| "fa-loader waitting"
