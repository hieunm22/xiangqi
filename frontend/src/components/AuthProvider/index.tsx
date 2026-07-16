import { useEffect, useState } from "react"
import { LS_TOKEN_KEY } from "common/constant"
import { getToken } from "common/helper"
import { useAPI } from "hooks/useAPI"
import { AuthContext } from "hooks/useAppContext"
import { ComponentWithChild } from "types/Common"

export const AuthProvider = (props: ComponentWithChild) => {
	const [isLoading, setIsLoading] = useState(true)
	const [isValidToken, setIsValidToken] = useState(false)
	const { validateToken } = useAPI()

	const checkToken = async () => {
		const token = getToken()
		if (!token) {
			setIsValidToken(false)
			setIsLoading(false)
			return
		}
		setIsLoading(true)
		try {
			const result = await validateToken(token)
			setIsValidToken(result.success)
			if (!result.success) {
				localStorage.removeItem(LS_TOKEN_KEY)
			}
		} catch {
			setIsValidToken(false)
			localStorage.removeItem(LS_TOKEN_KEY)
		} finally {
			setIsLoading(false)
		}
	}

	const markAuthenticated = () => {
		setIsValidToken(true)
		setIsLoading(false)
	}

	const handleLogout = () => {
		setIsValidToken(false)
		setIsLoading(false)
	}

	useEffect(() => {
		checkToken()
	}, [])

	return (
		<AuthContext.Provider value={{
			isLoading,
			isValidToken,
			refreshAuth: checkToken,
			markAuthenticated,
			setLogout: handleLogout
		}}>
			{props.children}
		</AuthContext.Provider>
	)
}
