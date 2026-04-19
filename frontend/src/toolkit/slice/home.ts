import { createSlice, type PayloadAction } from "@reduxjs/toolkit"
import type { ReduxState } from "../../types/ReduxState"

const initialState: ReduxState = {
	darkMode: false,
	lang: "en"
}

const homeSlice = createSlice({
	name: "home",
	initialState,
	reducers: {
		setDarkMode: (state, body: PayloadAction<boolean>) => {
			state.darkMode = body.payload
		},
		setLanguage: (state, body: PayloadAction<string>) => {
			state.lang = body.payload
		}
	}
})

export const { setDarkMode } = homeSlice.actions

const { reducer } = homeSlice
export default reducer
