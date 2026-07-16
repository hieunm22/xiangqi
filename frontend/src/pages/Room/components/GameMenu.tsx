import Stack from "@mui/material/Stack"
import classnames from "classnames"
import { TTooltip } from "components/TranslationTag"
import { GameMenuProps } from "../types"

export const GameMenu = (props: GameMenuProps) => (
	<Stack direction={{ xs: "row", sm: "column" }} spacing={1}>
		{props.buttons.map(item => {
			if (!item.visible) return null
			const iconClass = classnames("game-more-action", item.icon, {
				"disabled": !item.enabled
			})
			const handleClick = item.visible && item.enabled ? item.onClick : undefined

			return (
				<TTooltip title={item.label} key={item.key} placement="left">
					<i className={iconClass} onClick={handleClick} />
				</TTooltip>
			)
		})}
	</Stack>
)
