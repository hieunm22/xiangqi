import { PopupState } from "common/enums"
import useToolkit from "hooks/useToolkit"
import { setPopup, setUserId } from "toolkit/slice/game"

const useLayoutAuth = () => {
	const { dispatch } = useToolkit()

	// This function is used to open the profile popup when clicking on a user's avatar
	const showProfilePopup = (userId: number) => {
		dispatch(setUserId(userId))
		dispatch(setPopup(PopupState.PROFILE))
	}

	return {
		showProfilePopup
	}
}

export default useLayoutAuth
