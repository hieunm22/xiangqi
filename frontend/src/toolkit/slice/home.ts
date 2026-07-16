import { createSlice, PayloadAction } from "@reduxjs/toolkit"
import type { ReduxState } from "../../types/ReduxState"

const initialState: ReduxState = {
	darkMode: false,
	lang: "en",
	debugMode: false,
	soundEnabled: true,
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
		setSoundEnabled: (state, body: PayloadAction<boolean>) => {
			state.soundEnabled = body.payload
		},
	},
})

export const {
	setDarkMode,
	setDebug,
	setLanguage,
	setSoundEnabled,
} = homeSlice.actions

const { reducer } = homeSlice
export default reducer
