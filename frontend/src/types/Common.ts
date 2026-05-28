import type { CellProps } from "./GameState"
import type { ReduxState } from "./ReduxState"

export interface ReduxStore {
	home: ReduxState
}

export type EmptyVoid = () => void

export type EmptyPromise = () => Promise<void>

export type Nullable<T> = T | null

export interface APIResponse<T> {
	success: boolean
	data: T | null
	error: string
}

export interface DropdownProps {
	key: string
	icon?: string
	value: string
	disabled?: boolean
}

export interface ElementWithColorType {
	element: CellProps | null
	$index: number
	$selected?: boolean
	$available?: boolean
}

export interface ComponentWithChild {
	children: React.ReactNode
}

export interface ConfirmProps {
	title?: string
	message: string
}

export interface FenMoveDiffResult {
	oldIndex: number
	newIndex: number
	movedCell: CellProps
	capturedCell: CellProps | null
}
