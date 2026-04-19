import type { ChangeEvent, FocusEventHandler } from "react"
import type { DropdownProps } from "types/Common"

export interface ComboBoxWithLabelProps {
	id: string
	title?: string
	options: DropdownProps[]
	value: string
	errorMessage?: string
	blur?: FocusEventHandler<HTMLInputElement>
	change?: (e: ChangeEvent<HTMLInputElement>) => void
}
