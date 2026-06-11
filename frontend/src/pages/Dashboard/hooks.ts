import { PopupState } from "components/Layout/enums"
import { getToken } from "common/helper"
import { useAPI } from "hooks/useAPI"
import { usePopups } from "hooks/useAppContext"
import useToolkit from "hooks/useToolkit"
import { setPopup } from "toolkit/slice/game"
import { APIResponse } from "types/Common"
import { UserProfileWithStats } from "components/Layout/types"

const useLayoutAuth = () => {
	const { getUserById } = useAPI()
	const { setProfileUser } = usePopups()
	const { dispatch } = useToolkit()

	// This is a bit hacky but it works.
	// We want to be able to open the profile popup from the join room dialog,
	// which is a child of the dashboard page.
	// The join room dialog doesn't have access to the API or toolkit contexts,
	// so we pass down a function that can fetch user data and open the profile popup.
	const loadUserData = async (id: number) => {
		const token = getToken()
		if (!token) return
		const userData = await getUserById(token, id) as APIResponse<UserProfileWithStats>
		if (userData?.data) {
			setProfileUser(userData.data.user)
		}
		dispatch(setPopup(PopupState.PROFILE))
	}

	return {
		loadUserData
	}
}

export default useLayoutAuth
