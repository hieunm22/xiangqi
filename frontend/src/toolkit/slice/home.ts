import { createSlice, PayloadAction } from "@reduxjs/toolkit"
import { PopupState } from "components/Layout/enums"
import type { ReduxState } from "../../types/ReduxState"

const initialState: ReduxState = {
	darkMode: false,
	lang: "en",
	popupState: PopupState.NONE,
	gameHistoryUserId: null,
	debugMode: false
}

const homeSlice = createSlice({
	name: "home",
	initialState,
	reducers: {
		setDarkMode: (state, body: PayloadAction<boolean>) => {
			state.darkMode = body.payload
		},
		setDebug: (state, body: PayloadAction<boolean>) => {
			state.debugMode = body.payload
		},
		setLanguage: (state, body: PayloadAction<string>) => {
			state.lang = body.payload
		},
		setPopup: (state, body: PayloadAction<number>) => {
			state.popupState = body.payload
		},
		setGameHistoryUserId: (state, body: PayloadAction<number | null>) => {
			state.gameHistoryUserId = body.payload
		},
	}
})

export const {
	setDarkMode,
	setDebug,
	setGameHistoryUserId,
	setLanguage,
	setPopup,
} = homeSlice.actions

const { reducer } = homeSlice
export default reducer
