import { configureStore } from "@reduxjs/toolkit"
import gameSlice from "./slice/game"
import homeSlice from "./slice/home"

export const store = configureStore({
	reducer: {
		game: gameSlice,
		home: homeSlice
	}
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
