import { createContext, useContext } from "react"
import { AuthContextProps } from "components/AuthProvider/types"
import {
	CreateRoomContextValue,
	JoinRoomDialogContextValue,
	PieceSelectionContextValue
} from "pages/Dashboard/types"
import { RoomSettingsDialogContextValue } from "pages/Room/types"
import { ProfilePopupContextValue } from "components/Layout/types"

export const AuthContext = createContext<AuthContextProps>({
	isLoading: true,
	isValidToken: false,
	refreshAuth: async () => {},
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

export const JoinRoomDialogContext = createContext<JoinRoomDialogContextValue | null>(null)

export const useJoinRoomDialogContext = () => {
	const context = useContext(JoinRoomDialogContext)

	if (!context) {
		throw new Error("JoinRoomDialog must be used within JoinRoomDialogContext.Provider")
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

const PopupContext = createContext<ProfilePopupContextValue | null>(null)

export const PopupProvider = PopupContext.Provider

export const usePopups = () => {
	const context = useContext(PopupContext)
	if (!context) {
		throw new Error("usePopups must be used within PopupProvider")
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
