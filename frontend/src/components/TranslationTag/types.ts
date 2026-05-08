import React from "react"
import type { ButtonProps } from "@mui/material"

export type TButtonProps = ButtonProps

export type TDivProps = React.HTMLAttributes<HTMLDivElement>
export type TIProps = React.HTMLAttributes<HTMLElement>
export type TInputProps = React.InputHTMLAttributes<HTMLInputElement>
export type TLabelProps = React.LabelHTMLAttributes<HTMLLabelElement> & {
	text?: React.ReactNode
}
export type TSpanProps = React.HTMLAttributes<HTMLSpanElement> & {
	["data-text"]?: string
}
