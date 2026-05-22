import classnames from "classnames"
import { Button, Stack } from "@mui/material"
import { pieceSymbolByType } from "pages/Room/constant"
import { usePieceSelectionContext } from "hooks/useAppContext"
import { PieceButtonProps } from "../types"

const PieceButton = (props: PieceButtonProps) => {
	const { piece, label } = props
	const { selectedColor, setSelectedColor } = usePieceSelectionContext()
	const active = selectedColor === piece

	return (
		<Button
			variant={active ? "contained" : "outlined"}
			onClick={() => setSelectedColor(piece)}
			className={classnames("dashboard__piece-btn", piece, { active })}
			sx={{
				color: active
					? (piece === "red" ? "common.white" : "background.paper")
					: (piece === "red" ? "error.main" : "text.primary"),
				bgcolor: active
					? (piece === "red" ? "error.main" : "text.primary")
					: "transparent",
				borderColor: piece === "red" ? "error.main" : "divider",
				"&:hover": {
					bgcolor: active
						? (piece === "red" ? "error.dark" : "text.secondary")
						: "action.hover",
					borderColor: piece === "red" ? "error.main" : "text.primary"
				}
			}}
		>
			{label}
		</Button>
	)
}

export const PieceSelection = () => (
	<Stack direction="row" spacing={1.5} sx={{ mt: 1 }}>
		<PieceButton piece="red" label={pieceSymbolByType.red.general} />
		<PieceButton piece="black" label={pieceSymbolByType.black.general} />
	</Stack>
)
