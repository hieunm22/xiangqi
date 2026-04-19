import { useDispatch, useSelector } from "react-redux"
import type { ReduxStore } from "types/Common"
import type { GameState } from "types/GameState"

export default function useGameToolkit() {
	const state = useSelector<ReduxStore>(st => st.game) as GameState
	const dispatch = useDispatch()
	return {
		state,

		dispatch
	}
}
