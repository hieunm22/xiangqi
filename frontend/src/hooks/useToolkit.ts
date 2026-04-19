import { useDispatch, useSelector } from "react-redux"
import type { ReduxStore } from "types/Common"
import type { ReduxState } from "types/ReduxState"

export default function useToolkit() {
	const state = useSelector<ReduxStore>(st => st.home) as ReduxState
	const dispatch = useDispatch()
	return {
		state,

		dispatch
	}
}
