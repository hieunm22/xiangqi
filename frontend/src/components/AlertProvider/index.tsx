import { useEffect, useState } from "react"
import {
	Dialog,
	DialogContent,
	DialogTitle,
	Divider,
	Grid,
} from "@mui/material"
import { TButton, TTypography } from "components/TranslationTag"
import { setAlertHandler } from "./helper"
import { ComponentWithChild, ConfirmProps } from "types/Common"
import { AlertQueueItem } from "./types"
import "./AlertProvider.scss"

export const AlertProvider = (props: ComponentWithChild) => {
	const [queue, setQueue] = useState<AlertQueueItem[]>([])
	const [countdownLeft, setCountdownLeft] = useState<number | null>(null)

	useEffect(() => {
		setAlertHandler((options: ConfirmProps) => {
			return new Promise<void>(resolve => {
				setQueue([{ id: Date.now() + Math.random(), options, resolve }])
			})
		})

		return () => {
			setAlertHandler(null)
		}
	}, [])

	const current = queue[0] ?? null

	useEffect(() => {
		if (!current || current.options.countdownSeconds === undefined) {
			setCountdownLeft(null)
			return
		}

		setCountdownLeft(current.options.countdownSeconds)
		const intervalId = window.setInterval(() => {
			setCountdownLeft(prev => {
				if (prev === null || prev <= 0) {
					window.clearInterval(intervalId)
					return 0
				}

				return prev - 1
			})
		}, 1000)

		return () => {
			window.clearInterval(intervalId)
		}
	}, [current])

	useEffect(() => {
		if (!current || current.options.countdownSeconds === undefined) {
			return
		}

		if (countdownLeft !== 0) {
			return
		}

		current.resolve()
		setQueue([])
		setCountdownLeft(null)
	}, [countdownLeft, current])

	const getAlertMessage = () => {
		if (!current) {
			return ""
		}

		if (
			current.options.countdownMessageBuilder
			&& countdownLeft !== null
		) {
			return current.options.countdownMessageBuilder(countdownLeft)
		}

		return current.options.message
	}

	const onOk = () => {
		if (!current) return
		current.resolve()
		setQueue([])
		setCountdownLeft(null)
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
					<div className="alert-message-row">
						{current?.options.icon}
						<TTypography className="alert-message" content={getAlertMessage()} />
					</div>
					<Grid container className="button-container">
						<TButton
							className="btn btn-primary center"
							variant="outlined"
							size="small"
							onClick={onOk}
							value={current?.options.okLabel ?? "settings.close"}
						/>
					</Grid>
				</DialogContent>
			</Dialog>
		</>
	)
}

export default AlertProvider
