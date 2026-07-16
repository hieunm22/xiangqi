import { useEffect, useState } from "react"
import {
	DialogContent,
	DialogTitle,
	Divider,
	Grid,
} from "@mui/material"
import { PopupState } from "common/enums"
import { ResponsiveDialog } from "components/ResponsiveDialog"
import { TButton, TTypography } from "components/TranslationTag"
import { BotDifficultySlider } from "./Slider"
import useToolkit from "hooks/useToolkit"
import { setPopup } from "toolkit/slice/game"
import { NumberVoid } from "types/Common"

interface BotDifficultyPopupProps {
	onConfirm: NumberVoid
}

export const BotDifficultyPopup = (props: BotDifficultyPopupProps) => {
	const { gameState, dispatch } = useToolkit()
	const [level, setLevel] = useState(3)
	const isOpen = gameState.popupState === PopupState.BOT_DIFFICULTY

	useEffect(() => {
		if (isOpen) setLevel(3)
	}, [isOpen])

	const onCancel = () => dispatch(setPopup(PopupState.NONE))

	const onDialogClose = (_: any, reason?: "backdropClick" | "escapeKeyDown") => {
		if (reason === "backdropClick") return
		onCancel()
	}

	const onOk = () => {
		dispatch(setPopup(PopupState.NONE))
		props.onConfirm(level)
	}

	return (
		<ResponsiveDialog
			drawerAnchor="bottom"
			open={isOpen}
			onClose={onDialogClose}
			maxWidth="xs"
			fullWidth
			disableEnforceFocus
		>
			<DialogTitle className="popup-title">
				<TTypography component="div" className="flex" content="room.bot-difficulty.title" />
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
		</ResponsiveDialog>
	)
}

export default BotDifficultyPopup
