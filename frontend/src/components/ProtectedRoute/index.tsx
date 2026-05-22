import { Navigate } from "react-router-dom"
import { HOME_PATH, LOGIN_PATH } from "common/constant"
import { useAuth } from "hooks/useAppContext"

interface Props {
	children: React.ReactNode
	isPublicPage?: boolean
}

/**
 * ProtectedRoute component for handling authenticated routes
 * - If on login page and token is valid, redirects to home
 * - If on protected pages and token is invalid, redirects to login
 */
export const ProtectedRoute = ({
	children,
	isPublicPage = false
}: Props) => {
	const { isLoading, isValidToken } = useAuth()
	const isOnLoginPage = window.location.pathname === LOGIN_PATH
	// While checking token, don't render anything
	if (isLoading) {
		return null
	}

	// If on login page and token is valid, redirect to home
	if (isOnLoginPage && isValidToken) {
		return <Navigate to={HOME_PATH} replace />
	}

	// If on protected page (not public) and token is invalid, redirect to login
	if (!isPublicPage && !isValidToken) {
		return <Navigate to={LOGIN_PATH} replace />
	}

	// Otherwise render the component
	return <>{children}</>
}
