import { useEffect, useState } from "react"
import {
	Dialog,
	DialogContent,
	DialogTitle,
	Divider,
	Grid,
	Typography
} from "@mui/material"
import { TButton, TSpan } from "components/TranslationTag"
import { translate } from "locales/translate"
import { ComponentWithChild } from "types/Common"
import { ConfirmOptions, InternalHandler, QueueProps } from "./types"
import "./ConfirmProvider.scss"

let handler: InternalHandler | null = null

export function openConfirm(options: ConfirmOptions = {}): Promise<boolean> {
	if (!handler) return Promise.resolve(false)
	return handler(options)
}

export const ConfirmProvider = (props: ComponentWithChild) => {
	const [queue, setQueue] = useState<QueueProps[]>([])

	useEffect(() => {
		handler = (options: ConfirmOptions) => {
			return new Promise<boolean>(resolve => {
				setQueue([{ id: Date.now() + Math.random(), options, resolve }])
			})
		}

		return () => {
			handler = null
		}
	}, [])

	const current = queue[0] ?? null

	const onCancel = () => {
		if (!current) return
		current.resolve(false)
		setQueue([])
	}

	const onOk = () => {
		if (!current) return
		current.resolve(true)
		setQueue([])
		current.options.onOk?.()
	}

	return (
		<>
			{props.children}
			<Dialog
				open={!!current}
				maxWidth="xs"
				className="confirm-dialog"
				fullWidth
				disableEnforceFocus
			>
				<DialogTitle className="popup-title">
					<Typography component="div" className="flex">
						{translate(current?.options.title ?? "popup.confirm.title")}
					</Typography>
				</DialogTitle>
				<Divider className="mt-5 mb-5" />
				<DialogContent>
					<Typography className="confirm-message-row">
						<i className="fas fa-circle-question mt-4" />
						<TSpan content={current?.options.message ?? "popup.confirm.message"} />
					</Typography>
					<Grid container className="button-container">
						<TButton
							variant="contained"
							size="small"
							value={current?.options.okLabel ?? "popup.confirm.ok"}
							onClick={onOk}
						/>
						<TButton
							variant="outlined"
							size="small"
							value={current?.options.cancelLabel ?? "popup.confirm.cancel"}
							onClick={onCancel}
						/>
					</Grid>
				</DialogContent>
			</Dialog>
		</>
	)
}

export default ConfirmProvider
