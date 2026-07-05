export interface ReduxState {
	darkMode: boolean
	lang: string
	debugMode: boolean
}

export interface GameState {
	popupState: number
	activeUserId: number | null
	roomHostId: number | null
	inviteRoomId: number | null
	currentRoomId: number | null
	isInGame: boolean
}
