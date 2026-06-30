import { Slider } from "@mui/material"
import { translate } from "locales/translate"
import { BotDifficultyProps } from "./types"

export const BotDifficultySlider = (props: BotDifficultyProps) => {
	const MARKS = [
		{ value: 1, label: translate("room.bot-difficulty.beginner") },
		{ value: 2, label: translate("room.bot-difficulty.amateur") },
		{ value: 3, label: translate("room.bot-difficulty.intermediate") },
		{ value: 4, label: translate("room.bot-difficulty.advanced") },
		{ value: 5, label: translate("room.bot-difficulty.master") }
	]

	return (
		<Slider
			value={props.level}
			min={1}
			max={5}
			step={1}
			marks={MARKS}
			disabled={props.disabled}
			onChange={(_, v) => props.setLevel?.(v)}
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
	)
}