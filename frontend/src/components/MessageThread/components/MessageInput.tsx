import { KeyboardEvent } from "react"
import classnames from "classnames"
import { Box } from "@mui/material"
import { TI, TTextField } from "components/TranslationTag"
import { MessageInputProps } from "../types"
import "../MessageThread.scss"

export const MessageInput = (props: MessageInputProps) => {
	const {
		autoFocus,
		disabled,
		placeholder,
		value,

		onChange,
		onSend
	} = props

	const handleKeyDown = (e: KeyboardEvent) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault()
			onSend()
		}
	}

	const sendClass = classnames("fas fa-paper-plane message-send-icon", { disabled })

	return (
		<Box className="message-input-row">
			<TTextField
				value={value}
				onChange={e => onChange(e.target.value)}
				onKeyDown={handleKeyDown}
				placeholder={placeholder}
				size="small"
				autoFocus={autoFocus}
				fullWidth
				multiline
				maxRows={3}
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
