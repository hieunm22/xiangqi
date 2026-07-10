import { useEffect, useState } from "react"
import {
	Dialog,
	DialogContent,
	DialogTitle,
	Divider,
	Grid,
	Typography
} from "@mui/material"
import { TButton, TSpan, TTypography } from "components/TranslationTag"
import { ComponentWithChild } from "types/Common"
import { ConfirmOptions, QueueProps } from "./types"
import { setConfirmHandler } from "./helper"
import "./ConfirmProvider.scss"

export const ConfirmProvider = (props: ComponentWithChild) => {
	const [queue, setQueue] = useState<QueueProps[]>([])

	useEffect(() => {
		setConfirmHandler((options: ConfirmOptions) => {
			return new Promise<boolean>(resolve => {
				setQueue([{ id: Date.now() + Math.random(), options, resolve }])
			})
		})

		return () => {
			setConfirmHandler(null)
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
					<TTypography
						component="div"
						className="flex"
						content={current?.options.title ?? "popup.confirm.title"}
					/>
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
