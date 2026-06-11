import { createSlice, PayloadAction } from "@reduxjs/toolkit"
import { PopupState } from "components/Layout/enums"
import type { GameState } from "../../types/ReduxState"

const initialState: GameState = {
	popupState: PopupState.NONE,
	activeUserId: null,
	debugMode: false,
	roomInfo: null,
	roomHostId: null,
}

const gameSlice = createSlice({
	name: "game",
	initialState,
	reducers: {
		setDebug: (state, body: PayloadAction<boolean>) => {
			state.debugMode = body.payload
		},
		setPopup: (state, body: PayloadAction<number>) => {
			state.popupState = body.payload
		},
		setUserId: (state, body: PayloadAction<number | null>) => {
			state.activeUserId = body.payload
		},
		setRoomInfo: (state, body: PayloadAction<Pick<GameState, "roomInfo" | "roomHostId"> | null>) => {
			state.roomInfo = body.payload?.roomInfo ?? null
			state.roomHostId = body.payload?.roomHostId ?? null
		},
	},
})

export const {
	setDebug,
	setPopup,
	setRoomInfo,
	setUserId,
} = gameSlice.actions

const { reducer } = gameSlice
export default reducer
