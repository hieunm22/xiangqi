import { createSlice, PayloadAction } from "@reduxjs/toolkit"
import { PopupState } from "common/enums"
import type { GameState } from "../../types/ReduxState"

const initialState: GameState = {
	popupState: PopupState.NONE,
	activeUserId: null,
	roomHostId: null,
	inviteRoomId: null,
	currentRoomId: null,
	isCurrentRoomPlayer: false,
	isInGame: false,
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
		setInviteRoomId: (state, body: PayloadAction<number | null>) => {
			state.inviteRoomId = body.payload
		},
		setCurrentRoomId: (state, body: PayloadAction<number | null>) => {
			state.currentRoomId = body.payload
		},
		setIsCurrentRoomPlayer: (state, body: PayloadAction<boolean>) => {
			state.isCurrentRoomPlayer = body.payload
		},
		setIsInGame: (state, body: PayloadAction<boolean>) => {
			state.isInGame = body.payload
		},
	},
})

export const {
	setCurrentRoomId,
	setInviteRoomId,
	setIsCurrentRoomPlayer,
	setIsInGame,
	setPopup,
	setRoomHostId,
	setUserId,
} = gameSlice.actions

const { reducer } = gameSlice
export default reducer
