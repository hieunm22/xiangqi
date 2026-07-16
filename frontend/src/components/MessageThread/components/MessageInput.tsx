import { KeyboardEvent, useEffect, useId, useRef } from "react"
import classnames from "classnames"
import { Box } from "@mui/material"
import { TI, TTextField } from "components/TranslationTag"
import { MessageInputProps } from "../types"
import "../MessageThread.scss"

export const MessageInput = (props: MessageInputProps) => {
	const inputId = useId()
	const textareaRef = useRef<HTMLTextAreaElement | null>(null)
	const {
		autoFocus,
		disabled,
		placeholder,
		value,

		onChange,
		onSend
	} = props

	const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
		onChange(e.target.value)
		resizeTextarea(e.target)
	}

	const resizeTextarea = (textarea: HTMLTextAreaElement | null) => {
		if (!textarea) {
			return
		}

		const computedStyle = window.getComputedStyle(textarea)
		const lineHeight = Number.parseFloat(computedStyle.lineHeight) || 20
		const paddingTop = Number.parseFloat(computedStyle.paddingTop) || 0
		const paddingBottom = Number.parseFloat(computedStyle.paddingBottom) || 0
		const maxHeight = lineHeight * 3 + paddingTop + paddingBottom

		textarea.style.height = "auto"
		textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`
		textarea.style.overflowY = textarea.scrollHeight > maxHeight ? "auto" : "hidden"
	}

	useEffect(() => {
		resizeTextarea(textareaRef.current)
	}, [value])

	const handleKeyDown = (e: KeyboardEvent) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault()
			onSend()
		}
	}

	const sendClass = classnames("fas fa-paper-plane message-send-icon", { disabled })

	return (
		<Box className="message-input-row" sx={{ backgroundColor: "background.paper" }}>
			<TTextField
				id={inputId}
				name="message-input"
				value={value}
				onChange={handleChange}
				onKeyDown={handleKeyDown}
				placeholder={placeholder}
				size="small"
				autoFocus={autoFocus}
				fullWidth
				multiline
				maxRows={3}
				inputRef={textareaRef}
				slotProps={{
					input: {
						endAdornment: (
							<TI className={sendClass} onClick={onSend} />
						)
					}
				}}
			/>
		</Box>
	)
}

MessageInput.displayName = "MessageInput"
