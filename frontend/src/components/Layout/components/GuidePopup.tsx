import {
	Dialog,
	DialogContent,
	DialogTitle,
	Divider,
} from "@mui/material"
import { PopupState } from "common/enums"
import { Guide } from "components/Guide"
import { TButton } from "components/TranslationTag"
import useToolkit from "hooks/useToolkit"
import { translate } from "locales/translate"
import { setPopup } from "toolkit/slice/game"
import "../Layout.scss"

export const GuidePopup = () => {
	const { gameState, dispatch } = useToolkit()
	const handleCloseGuide = (_: unknown, reason: "backdropClick" | "escapeKeyDown") => {
		if (reason === "backdropClick") return
		dispatch(setPopup(PopupState.NONE))
	}

	return (
		<Dialog
			open={gameState.popupState === PopupState.GUIDE}
			onClose={handleCloseGuide}
			maxWidth="md"
			fullWidth
			disableEnforceFocus
		>
			<DialogTitle className="pt-8 pb-8">{translate("menu.guide")}</DialogTitle>
			<Divider sx={{ borderColor: "primary.main" }} />
			<DialogContent className="no-padding">
				<Guide />
			</DialogContent>
			<Divider sx={{ borderColor: "primary.main" }} />
			<div className="guide-dialog-actions">
				<TButton
					variant="outlined"
					size="medium"
					onClick={e => handleCloseGuide(e, "escapeKeyDown")}
					value="settings.close"
				/>
			</div>
		</Dialog>
	)
}
