import { useEffect, useState } from "react"
import {
	Dialog,
	DialogContent,
	DialogTitle,
	Divider,
	Grid,
} from "@mui/material"
import { ComponentWithChild, ConfirmProps } from "types/Common"
import { AlertHandler, AlertQueueItem } from "./types"
import { TButton, TTypography } from "components/TranslationTag"
import "./AlertProvider.scss"

let handler: AlertHandler | null = null

export function openAlert(options: ConfirmProps) {
	if (!handler) return Promise.resolve()
	return handler(options)
}

export const AlertProvider = (props: ComponentWithChild) => {
	const [queue, setQueue] = useState<AlertQueueItem[]>([])

	useEffect(() => {
		handler = (options: ConfirmProps) => {
			return new Promise<void>(resolve => {
				setQueue([{ id: Date.now() + Math.random(), options, resolve }])
			})
		}

		return () => {
			handler = null
		}
	}, [])

	const current = queue[0] ?? null

	const onOk = () => {
		if (!current) return
		current.resolve()
		setQueue([])
	}

	return (
		<>
			{props.children}
			<Dialog
				open={!!current}
				maxWidth="xs"
				fullWidth
				className="alert-dialog"
				disableEnforceFocus
			>
				<DialogTitle className="popup-title">
					<TTypography
						component="div"
						className="popup-title-text"
						content={current?.options.title ?? "popup.alert.title"}
					/>
				</DialogTitle>
				<Divider className="divider" />
				<DialogContent>
					<TTypography className="alert-message" content={current?.options.message} />
					<Grid container className="button-container">
						<TButton
							className="btn btn-primary center"
							variant="outlined"
							size="small"
							onClick={onOk}
							value="settings.close"
						/>
					</Grid>
				</DialogContent>
			</Dialog>
		</>
	)
}

export default AlertProvider
