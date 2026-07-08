import { Slider } from "@mui/material"
import { translate } from "locales/translate"
import { BotDifficultyProps } from "./types"
import "./BotDifficulty.scss"

export const BotDifficultySlider = (props: BotDifficultyProps) => {
	const levelClassName = `level-${props.level}`

	const MARKS = [
		{ value: 1, label: translate("room.bot-difficulty.beginner") },
		{ value: 2, label: translate("room.bot-difficulty.amateur") },
		{ value: 3, label: translate("room.bot-difficulty.intermediate") },
		{ value: 4, label: translate("room.bot-difficulty.advanced") },
		{ value: 5, label: translate("room.bot-difficulty.master") }
	]

	return (
		<Slider
			className={`bot-difficulty-slider ${levelClassName}`}
			value={props.level}
			min={1}
			max={5}
			step={1}
			marks={MARKS}
			disabled={props.disabled}
			onChange={(_, v) => props.setLevel?.(v)}
		/>
	)
}