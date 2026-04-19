import { forwardRef } from "react"
import {
	TextField,
	Typography,
	type TextFieldProps,
	type TypographyProps
} from "@mui/material"
import { translate as t } from "../../locales/translate"
import type {
	TButtonProps,
	TDivProps,
	TInputProps,
	TIProps,
	TLabelProps,
	TSpanProps
} from "./types"

const TButton = forwardRef<HTMLButtonElement, Partial<TButtonProps>>((props, ref) => {
	const translatedProps = {
		...props,
		value: typeof props.value === "string" ? t(props.value) : props.value,
		title: typeof props.title === "string" ? t(props.title) : props.title
	}

	return (
		<button ref={ref} {...translatedProps}>
			{props.children ?? translatedProps.value}
		</button>
	)
})

const TDiv = (props: TDivProps) => {
	const translatedProps = {
		...props,
		title: typeof props.title === "string" ? t(props.title) : props.title,
		text: typeof props.content === "string" ? t(props.content) : props.content
	}

	return <div {...translatedProps} />
}

const TI = (props: TIProps) => {
	const translatedProps = {
		...props,
		title: typeof props.title === "string" ? t(props.title) : props.title
	}

	return <i {...translatedProps} />
}

const TInput = forwardRef<HTMLInputElement, TInputProps>((props, ref) => {
	const translatedProps = {
		...props,
		placeholder:
			typeof props.placeholder === "string" ? t(props.placeholder) : props.placeholder,
		title: typeof props.title === "string" ? t(props.title) : props.title,
		value: typeof props.value === "string" ? t(props.value) : props.value
	}

	return <input ref={ref} {...translatedProps} />
})

const TLabel = (props: TLabelProps) => {
	const translatedProps = {
		...props,
		title: typeof props.title === "string" ? t(props.title) : props.title,
		text: typeof props.text === "string" ? t(props.text) : props.text
	}

	return <label {...translatedProps}>{props.text ?? props.children}</label>
}

const TSpan = forwardRef<HTMLElement, TSpanProps>((props, ref) => {
	const translatedProps = {
		...props,
		title: typeof props.title === "string" ? t(props.title) : props.title,
		text: typeof props.content === "string" ? t(props.content) : props.content
	}

	return (
		<span data-text={props["data-text"]} ref={ref} {...translatedProps}>
			{translatedProps.text}
		</span>
	)
})

const TTextField = (props: TextFieldProps) => {
	const translatedProps = {
		...props,
		helperText: typeof props.helperText === "string" ? t(props.helperText) : props.helperText,
		label: typeof props.label === "string" ? t(props.label) : props.label,
		placeholder:
			typeof props.placeholder === "string" ? t(props.placeholder) : props.placeholder
	}

	return <TextField {...translatedProps} />
}

const TTypography = (props: TypographyProps) => {
	const translatedProps = {
		...props,
		content: typeof props.content === "string" ? t(props.content) : props.content
	}

	return <Typography {...translatedProps}>{translatedProps.content}</Typography>
}

TButton.displayName = "TButton"
TDiv.displayName = "TDiv"
TI.displayName = "TI"
TInput.displayName = "TInput"
TLabel.displayName = "TLabel"
TSpan.displayName = "TSpan"
TTextField.displayName = "TTextField"
TTypography.displayName = "TTypography"

export { TButton, TDiv, TI, TInput, TLabel, TSpan, TTextField, TTypography }
