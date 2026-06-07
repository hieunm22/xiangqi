import { TI } from "components/TranslationTag"
import RoomSettingsDialog from "./RoomSettingsDialog"
import { RoomSettingsDialogContext } from "hooks/useAppContext"
import { SettingsButtonProps } from "../types"

export const SettingsButton = (props: SettingsButtonProps) => {
	return (
		<RoomSettingsDialogContext.Provider value={props}>
			<TI className="room-more-action fas fa-gear" onClick={props.openSettings} />
			<RoomSettingsDialog />
		</RoomSettingsDialogContext.Provider>
	)
}

export default SettingsButton
