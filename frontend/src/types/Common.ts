import type { CellProps } from "./GameState"
import type { GameState, ReduxState } from "./ReduxState"

export interface ReduxStore {
	game: GameState
	home: ReduxState
}

export type EmptyVoid = () => void

export type EmptyPromise = () => Promise<void>

export type Nullable<T> = T | null

export interface APIResponseEmpty {
	success: boolean
	status_code: number
	message: string
}

export interface APIResponse<T> {
	success: boolean
	data: T
	status_code: number
	message: string
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

export type UserAvatarType = {
	id: number
	display_name: string
	avatar_url: string
}
