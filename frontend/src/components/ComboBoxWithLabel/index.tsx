import { useEffect, useState } from "react"
import {
	FormControl,
	FormHelperText,
	Grid,
	InputLabel,
	MenuItem,
	Select
} from "@mui/material"
import { translate } from "../../locales/translate"
import TranslationText from "../../components/TranslationText"
import type { ComboBoxWithLabelProps } from "./types"
import "./ComboBoxWithLabel.scss"

export const ComboBoxWithLabel = (props: ComboBoxWithLabelProps) => {
	const [value, setValue] = useState("")

	useEffect(() => {
		setValue(props.value)
	}, [props.value])

	const handleChange = (e: any) => {
		setValue(e.target.value)
		props.change && props.change(e)
	}

	return (
		<Grid className="no-label__text-row">
			<FormControl
				fullWidth
				variant="standard"
				error={!!props.errorMessage}
			>
				{props.title && (
					<InputLabel>
						<TranslationText text={props.title} />
					</InputLabel>
				)}
				<Select
					name={props.id}
					labelId="language-label"
					value={value}
					onBlur={props.blur}
					onChange={handleChange}
				>
					{props.options.map(option => (
						<MenuItem
							key={option.key}
							value={option.key}
							disabled={option.disabled}
						>
							{option.icon && (
								<img
									className="dropdown-flag"
									src={option.icon}
									alt={option.value}
								/>
							)}
							{translate(option.value)}
						</MenuItem>
					))}
				</Select>
				<FormHelperText>{props.errorMessage}</FormHelperText>
			</FormControl>
		</Grid>
	)
}
