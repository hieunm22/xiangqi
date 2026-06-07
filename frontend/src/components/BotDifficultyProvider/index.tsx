import { useEffect, useState } from "react"
import {
	Dialog,
	DialogContent,
	DialogTitle,
	Divider,
	Grid,
	Slider,
	Typography
} from "@mui/material"
import { TButton } from "components/TranslationTag"
import useAutoTitle from "hooks/useAutoTitle"
import { translate } from "locales/translate"
import { ComponentWithChild } from "types/Common"

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

	const MARKS = [
		{ value: 1, label: translate("room.bot-difficulty.beginner") },
		{ value: 2, label: translate("room.bot-difficulty.amateur") },
		{ value: 3, label: translate("room.bot-difficulty.intermediate") },
		{ value: 4, label: translate("room.bot-difficulty.advanced") },
		{ value: 5, label: translate("room.bot-difficulty.master") }
	]

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

	const onOk = () => {
		if (!current) return
		current.resolve(level)
		setQueue([])
	}

	return (
		<>
			{props.children}
			<Dialog open={!!current} maxWidth="xs" fullWidth disableRestoreFocus>
				<DialogTitle padding="5px 20px !important">
					<Typography component="div" className="flex">
						{translate("room.bot-difficulty.title")}
					</Typography>
				</DialogTitle>
				<Divider className="mt-5 mb-5" />
				<DialogContent className="pl-50 pr-50">
					<Slider
						value={level}
						min={1}
						max={5}
						step={1}
						marks={MARKS}
						onChange={(_, v) => setLevel(v)}
						sx={{
							mb: 3,
							"& .MuiSlider-markLabel": {
								fontSize: 12,
								whiteSpace: "normal",
								textAlign: "center",
								width: 64,
								lineHeight: 1.2
							}
						}}
					/>
					<Grid container justifyContent="flex-end" gap={2}>
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
