import { useEffect, useState } from "react"
import { getToken } from "common/helper"
import { useAPI } from "hooks/useAPI"
import { AuthContext } from "hooks/useAppContext"

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
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
		} catch {
			setIsValidToken(false)
		} finally {
			setIsLoading(false)
		}
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
			setLogout: handleLogout
		}}>
			{children}
		</AuthContext.Provider>
	)
}
