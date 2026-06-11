import { useDispatch, useSelector } from "react-redux"
import type { ReduxStore } from "types/Common"
import type { GameState, ReduxState } from "types/ReduxState"

export default function useToolkit() {
	const state = useSelector<ReduxStore>(st => st.home) as ReduxState
	const gameState = useSelector<ReduxStore>(st => st.game) as GameState
	const dispatch = useDispatch()
	return {
		state,
		gameState,

		dispatch
	}
}
