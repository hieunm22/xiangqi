import { RoomInfo } from "pages/Room/types"

export interface ReduxState {
	darkMode: boolean
	lang: string
}

export interface GameState {
	popupState: number
	activeUserId: number | null
	debugMode: boolean
	roomInfo: RoomInfo | null
	roomHostId: number | null
}
