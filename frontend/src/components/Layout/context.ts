import { createContext, useContext } from "react"
import { Users } from "types/Entities"

type ProfilePopupContextValue = {
	openProfilePopup: boolean
	openSettings: boolean
	profileUser: Users | null
	setOpenProfilePopup: (open: boolean) => void
	setOpenSettings: (open: boolean) => void
	setProfileUser: (user: Users | null) => void
}

const PopupContext = createContext<ProfilePopupContextValue | null>(null)

export const PopupProvider = PopupContext.Provider

export const usePopups = () => {
	const context = useContext(PopupContext)
	if (!context) {
		throw new Error("usePopups must be used within PopupProvider")
	}

	return context
}