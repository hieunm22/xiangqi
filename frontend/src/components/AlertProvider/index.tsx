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
import { ComponentWithChild, ConfirmProps as AlertOptions } from "types/Common"
import { AlertHandler, AlertQueueItem } from "./types"

let handler: AlertHandler | null = null

export function openAlert(options: AlertOptions): Promise<void> {
	if (!handler) return Promise.resolve()
	return handler(options)
}

export const AlertProvider = ({ children }: ComponentWithChild) => {
	const [queue, setQueue] = useState<AlertQueueItem[]>([])

	useEffect(() => {
		handler = (options: AlertOptions) => {
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
						{current?.options.title ?? translate("popup.alert.title")}
					</Typography>
				</DialogTitle>
				<Divider sx={{ my: "5px" }} />
				<DialogContent>
					<Typography sx={{ textAlign: "center", mb: 1 }}>
						{current?.options.message}
					</Typography>
					<Grid container justifyContent="center">
						<Button
							className="btn btn-primary mt-20 center"
							variant="outlined"
							size="small"
							onClick={onOk}
						>
							{translate("settings.close")}
						</Button>
					</Grid>
				</DialogContent>
			</Dialog>
		</>
	)
}

export default AlertProvider
