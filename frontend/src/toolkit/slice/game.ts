import { createSlice, PayloadAction } from "@reduxjs/toolkit"
import { PopupState } from "common/enums"
import type { GameState } from "../../types/ReduxState"

const initialState: GameState = {
	popupState: PopupState.NONE,
	activeUserId: null,
	roomHostId: null,
}

const gameSlice = createSlice({
	name: "game",
	initialState,
	reducers: {
		setPopup: (state, body: PayloadAction<number>) => {
			state.popupState = body.payload
		},
		setUserId: (state, body: PayloadAction<number | null>) => {
			state.activeUserId = body.payload
		},
		setRoomHostId: (state, body: PayloadAction<number | null>) => {
			state.roomHostId = body.payload
		},
	},
})

export const {
	setPopup,
	setRoomHostId,
	setUserId,
} = gameSlice.actions

const { reducer } = gameSlice
export default reducer
