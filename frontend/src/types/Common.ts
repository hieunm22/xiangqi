import type { CellProps, GameState } from "./GameState"
import type { ReduxState } from "./ReduxState"

export interface ReduxStore {
	home: ReduxState
	game: GameState
}

export type EmptyVoid = () => void

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

export interface ElementWithAnimationType {
	$move: boolean
	$dx: number
	$dy: number
}

export interface ComponentWithChild {
	children: React.ReactNode
}

export interface ConfirmProps {
	title?: string
	message: string
}
