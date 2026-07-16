import { EmptyPromise, EmptyVoid } from "types/Common"

export interface AuthContextProps {
	isLoading: boolean
	isValidToken: boolean
	refreshAuth: EmptyPromise
	markAuthenticated: EmptyVoid
	setLogout: EmptyVoid
}
