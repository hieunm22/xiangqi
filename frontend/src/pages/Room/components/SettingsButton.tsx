import { TI, TTooltip } from "components/TranslationTag"
import RoomSettingsDialog from "./RoomSettingsDialog"
import { RoomSettingsDialogContext } from "hooks/useAppContext"
import { SettingsButtonProps } from "../types"

export const SettingsButton = (props: SettingsButtonProps) => {
	return (
		<RoomSettingsDialogContext.Provider value={props}>
			<TTooltip title="room.settings.title" placement="left">
				<TI className="room-more-action fas fa-gear" onClick={props.openSettings} />
			</TTooltip>
			<RoomSettingsDialog />
		</RoomSettingsDialogContext.Provider>
	)
}

export default SettingsButton
