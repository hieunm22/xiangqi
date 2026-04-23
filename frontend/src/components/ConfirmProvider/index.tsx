import { useEffect, useState } from "react"
import {
	Button,
	Dialog,
	DialogContent,
	DialogTitle,
	Divider,
	Grid,
	Typography
} from "@mui/material"
import { translate } from "locales/translate"
import { ComponentWithChild } from "types/Common"
import { ConfirmOptions, InternalHandler, QueueProps } from "./types"

let handler: InternalHandler | null = null

export function openConfirm(options: ConfirmOptions = {}): Promise<boolean> {
	if (!handler) return Promise.resolve(false)
	return handler(options)
}

export const ConfirmProvider = ({ children }: ComponentWithChild) => {
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
	}

	const textCenterStyle = {
		display: "flex",
		justifyContent: "center",
		alignItems: "center"
	}

	return (
		<>
			{children}
			<Dialog
				open={!!current}
				maxWidth="xs"
				fullWidth
				disableRestoreFocus
			>
				<DialogTitle padding="5px 20px !important">
					<Typography component="div" sx={textCenterStyle}>
						{current?.options.title ?? translate("popup.confirm.title")}
					</Typography>
				</DialogTitle>
				<Divider sx={{ my: "5px" }} />
				<DialogContent>
					<Typography sx={{ textAlign: "center", mb: 2 }}>
						{current?.options.message && translate(current.options.message)}
					</Typography>
					<Grid container justifyContent="center" gap={2}>
						<Button
							variant="outlined"
							size="small"
							onClick={onOk}
						>
							{translate("popup.confirm.ok")}
						</Button>
						<Button
							variant="outlined"
							color="inherit"
							size="small"
							onClick={onCancel}
						>
							{translate("popup.confirm.cancel")}
						</Button>
					</Grid>
				</DialogContent>
			</Dialog>
		</>
	)
}

export default ConfirmProvider
