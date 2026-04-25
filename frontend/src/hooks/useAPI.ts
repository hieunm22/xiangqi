import wretch from "wretch"
import FormDataAddon from "wretch/addons/formData"
import { getLanguage } from "common/helper"
import { LoginBodyType } from "pages/Login/types"

const EP = { // end points
	// login endpoints
	login: "/auth/login",

	refreshToken: "/auth/refresh-token",

	logout: "/auth/logout",
}

export const useAPI = () => {
	// const navigate = useNavigate()
	const CLIENT_BASE_URL = `${import.meta.env.VITE_BACKEND_BASE_URL}/api`
	// const wretchOptions: WretchOptions = {
	// 	credentials: "include",
	// 	mode: "cors"
	// }

	// wretch request without permission send with cookie
	const request = wretch(CLIENT_BASE_URL)
		.options({ mode: "cors" })
		.headers({ language: getLanguage() })

	// wretch request with permission send with cookie
	const requestWithCookie = request
		.options({ credentials: "include" })

	// const subscribers: ((token: string) => void)[] = []

	// const notifySubscribers = (token: string) => {
	// 	subscribers.forEach(cb => cb(token))
	// 	// empty subscribers array
	// 	subscribers.length = 0
	// }

	// const refreshAccessToken = async (currentToken: string) => {
	// 	const newAccessToken = await requestWithCookie
	// 		.auth(`Bearer ${currentToken}`)
	// 		.url(EP.refreshToken)
	// 		.options(wretchOptions)
	// 		.post() // refresh token should get from cookie from backend
	// 		.text()

	// 	localStorage.setItem(LS_TOKEN_KEY, newAccessToken)
	// 	return newAccessToken
	// }

	// const authFetch = (path: string) => {
	// 	const accessToken = getToken()
	// 	return requestWithCookie
	// 		.url(path)
	// 		.auth(`Bearer ${accessToken}`)
	// 		.resolve(r => r)
	// 		.catcher(401, async (_, request) => {
	// 			try {
	// 				// attach current access token to refresh token request's header
	// 				const newToken = await refreshAccessToken(accessToken)
	// 				notifySubscribers(newToken)
	// 				return request
	// 					.auth(`Bearer ${newToken}`)
	// 					.headers({ "skip-auth": "true" })
	// 					.fetch()
	// 					.json(r => r)
	// 			} catch (err) {
	// 				console.error("Token refresh failed", err)
	// 				await logout(accessToken)
	// 				localStorage.removeItem(LS_TOKEN_KEY)
	// 				navigate("/login")
	// 				throw err
	// 			}
	// 		})
	// }

	const login = (form: LoginBodyType) => requestWithCookie.url(EP.login)
							.addon(FormDataAddon)
							.formData(form)
							.post()
							.json(identityLoginRequestCallback)
							.catch(handleError)
	
	const logout = (token: string) => requestWithCookie.url(EP.logout)
							.auth(`Bearer ${token}`)
							.delete()
							.text(handleLogoutCallback)
							.catch(handleError)

	const identityLoginRequestCallback = (response: any) => {
		return response
	}

	const handleLogoutCallback = (response: any) => {
		return response
	}
	
	const handleError = (reason: any) => {
		return {
			message: reason.message,
			status: reason.status
		}
	}

	return {
		login,
    logout
	}
}
