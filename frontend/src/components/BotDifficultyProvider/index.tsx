import { useEffect, useState } from "react"
import {
	Dialog,
	DialogContent,
	DialogTitle,
	Divider,
	Grid,
	Typography
} from "@mui/material"
import { TButton } from "components/TranslationTag"
import useAutoTitle from "hooks/useAutoTitle"
import { translate } from "locales/translate"
import { ComponentWithChild } from "types/Common"
import { BotDifficultySlider } from "./components"

interface QueueProps {
	id: number
	resolve: (v: number | null) => void
}

type InternalHandler = () => Promise<number | null>

let handler: InternalHandler | null = null

export function openBotDifficulty(): Promise<number | null> {
	if (!handler) return Promise.resolve(null)
	return handler()
}

export const BotDifficultyProvider = (props: ComponentWithChild) => {
	const [queue, setQueue] = useState<QueueProps[]>([])
	const [level, setLevel] = useState(3)
	useAutoTitle()

	useEffect(() => {
		handler = () => {
			return new Promise<number | null>(resolve => {
				setLevel(3)
				setQueue([{ id: Date.now() + Math.random(), resolve }])
			})
		}

		return () => {
			handler = null
		}
	}, [])

	const current = queue[0] ?? null

	const onCancel = () => {
		if (!current) return
		current.resolve(null)
		setQueue([])
	}

	const onDialogClose = (_: any, reason?: "backdropClick" | "escapeKeyDown") => {
		if (reason === "backdropClick") return
		onCancel()
	}

	const onOk = () => {
		if (!current) return
		current.resolve(level)
		setQueue([])
	}

	return (
		<>
			{props.children}
			<Dialog
				open={!!current}
				onClose={onDialogClose}
				maxWidth="xs"
				fullWidth
				disableEnforceFocus
			>
				<DialogTitle className="popup-title">
					<Typography component="div" className="flex">
						{translate("room.bot-difficulty.title")}
					</Typography>
				</DialogTitle>
				<Divider className="mt-5 mb-5" />
				<DialogContent className="pl-50 pr-50">
					<BotDifficultySlider
						level={level}
						setLevel={setLevel}
						disabled={false}
					/>
					<Grid container sx={{ justifyContent: "flex-end", gap: 2 }}>
						<TButton
							variant="contained"
							size="small"
							value="popup.confirm.ok"
							onClick={onOk}
						/>
						<TButton
							variant="outlined"
							size="small"
							value="popup.confirm.cancel"
							onClick={onCancel}
						/>
					</Grid>
				</DialogContent>
			</Dialog>
		</>
	)
}

export default BotDifficultyProvider
