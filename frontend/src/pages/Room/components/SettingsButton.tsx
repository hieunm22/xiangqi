import { TI } from "components/TranslationTag"
import RoomSettingsDialog from "./RoomSettingsDialog"
import { RoomSettingsDialogContext } from "hooks/useAppContext"
import { EmptyVoid } from "types/Common"
import { RoomInfo } from "../types"

interface SettingsButtonProps {
	room: RoomInfo | null
	isOpen: boolean
	closeSettings: EmptyVoid
	handleSettingsSaved: (newName: string) => void
	openSettings: EmptyVoid
}

export const SettingsButton = (props: SettingsButtonProps) => {
	return (
		<RoomSettingsDialogContext.Provider value={props}>
			<TI className="room-more-action fas fa-gear" onClick={props.openSettings} />
			<RoomSettingsDialog />
		</RoomSettingsDialogContext.Provider>
	)
}

export default SettingsButton
