import { createContext, useContext } from "react"
import { AuthContextProps } from "components/AuthProvider/types"
import { ProfilePopupContextValue } from "components/Layout/types"
import { CreateRoomContextValue, PieceSelectionContextValue } from "pages/Dashboard/types"
import { RoomChatDialogContextValue, RoomSettingsDialogContextValue } from "pages/Room/types"

export const AuthContext = createContext<AuthContextProps>({
	isLoading: true,
	isValidToken: false,
	refreshAuth: async () => {},
	markAuthenticated: () => {},
	setLogout: () => {}
})

export const useAuth = () => useContext(AuthContext)

export const CreateRoomDialogContext = createContext<CreateRoomContextValue | null>(null)

export const useCreateRoomDialogContext = () => {
	const context = useContext(CreateRoomDialogContext)

	if (!context) {
		throw new Error("CreateRoomDialog must be used within CreateRoomDialogContext.Provider")
	}

	return context
}

export const PieceSelectionContext = createContext<PieceSelectionContextValue | null>(null)

export const usePieceSelectionContext = () => {
	const context = useContext(PieceSelectionContext)

	if (!context) {
		throw new Error("PieceSelection must be used within PieceSelectionContext.Provider")
	}

	return context
}

const ProfilePopupContext = createContext<ProfilePopupContextValue | null>(null)

export const ProfilePopupProvider = ProfilePopupContext.Provider

export const useProfilePopup = () => {
	const context = useContext(ProfilePopupContext)
	if (!context) {
		throw new Error("useProfilePopup must be used within ProfilePopupProvider")
	}

	return context
}

export const RoomChatDialogContext = createContext<RoomChatDialogContextValue | null>(null)

export const useRoomChatDialogContext = () => {
	const context = useContext(RoomChatDialogContext)

	if (!context) {
		throw new Error("RoomChatDialog must be used within RoomChatDialogContext.Provider")
	}

	return context
}

export const RoomSettingsDialogContext = createContext<RoomSettingsDialogContextValue | null>(null)

export const useRoomSettingsDialogContext = () => {
	const context = useContext(RoomSettingsDialogContext)

	if (!context) {
		throw new Error("RoomSettingsDialog must be used within RoomSettingsDialogContext.Provider")
	}

	return context
}
