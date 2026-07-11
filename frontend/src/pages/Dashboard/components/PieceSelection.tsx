import classnames from "classnames"
import { Button, Stack } from "@mui/material"
import { GameType, VariantConfig } from "common/variants"
import { pieceSymbolByType } from "pages/Room/variants/xiangqi/constants"
import { usePieceSelectionContext } from "hooks/useAppContext"
import { PieceButtonProps } from "../types"

// Glyph shown on each seat button, per variant.
const symbolFor = (gameType: GameType, team: string): React.ReactNode => {
	if (gameType === "xiangqi") {
		return team === "red" ? pieceSymbolByType.g : pieceSymbolByType.G
	}
	return <i className="fas fa-chess-king" />
}

// Accent color keyed by seat name (red/white/black).
const accentByTeam: Record<string, string> = {
	red: "error.main",
	white: "grey.400",
	black: "text.primary"
}

const PieceButton = (props: PieceButtonProps) => {
	const { piece, label } = props
	const { selectedColor, setSelectedColor } = usePieceSelectionContext()
	const active = selectedColor === piece
	const accent = accentByTeam[piece] ?? "text.primary"
	const activeText = piece === "red" ? "common.white" : "background.paper"
	const btnClass = classnames("dashboard__piece-btn", piece, { active })

	return (
		<Button
			variant={active ? "contained" : "outlined"}
			onClick={() => setSelectedColor(piece)}
			className={btnClass}
			sx={{
				color: active ? activeText : accent,
				bgcolor: active ? accent : "transparent",
				borderColor: accent,
				"&:hover": {
					bgcolor: active ? accent : "action.hover",
					borderColor: accent
				}
			}}
		>
			{label}
		</Button>
	)
}

export const PieceSelection = ({ variant }: { variant: VariantConfig }) => {
	const [first, second] = variant.teams
	return (
		<Stack direction="row" spacing={1.5} sx={{ mt: 1 }}>
			<PieceButton piece={first} label={symbolFor(variant.gameType, first)} />
			<PieceButton piece={second} label={symbolFor(variant.gameType, second)} />
		</Stack>
	)
}
