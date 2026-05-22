import { Users } from "types/Entities"

export interface UserProfileProps {
	isOwnProfile: boolean
}

export type ProfilePopupContextValue = {
	openProfilePopup: boolean
	openSettings: boolean
	profileUser: Users | null
	setOpenProfilePopup: (open: boolean) => void
	setOpenSettings: (open: boolean) => void
	setProfileUser: (user: Users | null) => void
}
