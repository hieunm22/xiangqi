import { useNavigate } from "react-router-dom"
import wretch, { WretchOptions } from "wretch"
import FormDataAddon from "wretch/addons/formData"
import { LOGIN_PATH, LS_TOKEN_KEY } from "common/constant"
import { getLanguage, getToken } from "common/helper"
import { CreateRoomRequest } from "pages/Dashboard/types"
import { LoginBodyType, LoginSuccessResponse } from "pages/Login/types"
import { ForgotPasswordBodyType } from "pages/LostPassword/types"
import { ResetPasswordBodyType } from "pages/ResetPassword/types"

const EP = { // end points
	// auth endpoints
	getUser: "/auth/user",
	login: "/auth/login",
	logout: "/auth/logout",
	refreshToken: "/auth/refresh-token",
	register: "/auth/register",
	validateToken: "/auth/validate-token",
	forgotPassword: "/auth/forgot-password",
	resetPassword: "/auth/reset-password",

	// room endpoints
	createRoom: "/room/create-room",
	fetchRooms: "/room/fetch-rooms",
	getRoomInfo: "/room/info",
	joinRoom: "/room/join",
	leaveRoom: "/room/leave",
}

export const useAPI = () => {
	const navigate = useNavigate()
	const CLIENT_BASE_URL = `${import.meta.env.VITE_BACKEND_BASE_URL}/api`
	const wretchOptions: WretchOptions = {
		credentials: "include",
		mode: "cors"
	}

	// wretch request without permission send with cookie
	const request = wretch(CLIENT_BASE_URL)
		.options({ mode: "cors" })
		.headers({ language: getLanguage() })

	// wretch request with permission send with cookie
	const requestWithCookie = request
		.options({ credentials: "include" })

	const subscribers: ((token: string) => void)[] = []

	const notifySubscribers = (token: string) => {
		subscribers.forEach(cb => cb(token))
		// empty subscribers array
		subscribers.length = 0
	}

	const refreshAccessToken = async (currentToken: string) => {
		const response: LoginSuccessResponse = await requestWithCookie
			.auth(`Bearer ${currentToken}`)
			.url(EP.refreshToken)
			.options(wretchOptions)
			.post() // refresh token should get from cookie from backend
			.json()

		localStorage.setItem(LS_TOKEN_KEY, response.access_token)
		return response.access_token
	}

	const authFetch = (path: string) => {
		const accessToken = getToken()
		return requestWithCookie
			.url(path)
			.auth(`Bearer ${accessToken}`)
			.resolve(r => r)
			.catcher(401, async (_, request) => {
				try {
					// attach current access token to refresh token request's header
					const newToken = await refreshAccessToken(accessToken)
					notifySubscribers(newToken)
					return request
						.auth(`Bearer ${newToken}`)
						.headers({ "skip-auth": "true" })
						.fetch()
						.json(r => r)
				} catch (err) {
					console.error("Token refresh failed", err)
					await logout(accessToken)
					localStorage.removeItem(LS_TOKEN_KEY)
					navigate(LOGIN_PATH)
					throw err
				}
			})
	}

const createRoom = async (token: string, body: CreateRoomRequest) => authFetch(EP.createRoom)
						.auth(`Bearer ${token}`)
						.post(body)
						.json(createRoomCallback)
							.catch(handleError)

	const getUserById = async (userId: number) => request.url(`${EP.getUser}/${userId}`)
							.get()
							.json(getUserCallback)
							.catch(handleError)

	const getRoomById = async (token: string, roomId: number) => authFetch(`${EP.getRoomInfo}/${roomId}`)
							.auth(`Bearer ${token}`)
							.get()
							.json(getRoomCallback)
							.catch(handleError)

	const joinRoom = async (token: string, roomId: number) => authFetch(EP.joinRoom)
							.auth(`Bearer ${token}`)
							.post({ id: roomId })
							.json(joinRoomCallback)
							.catch(handleError)

	const leaveRoom = async (token: string, roomId: number) => authFetch(EP.leaveRoom)
							.auth(`Bearer ${token}`)
							.json({ id: roomId })
							.delete()
							.json(leaveRoomCallback)
							.catch(handleError)

	const login = (form: LoginBodyType) => requestWithCookie.url(EP.login)
							.addon(FormDataAddon)
							.formData(form)
							.post()
							.json(loginCallback)
							.catch(handleError)

	const register = (form: any) => requestWithCookie.url(EP.register)
							.json(form)
							.post()
							.json(registerCallback)
							.catch(handleError)
	const forgotPassword = (form: ForgotPasswordBodyType) => requestWithCookie.url(EP.forgotPassword)
						.json(form)
						.post()
						.json(forgotPasswordCallback)
						.catch(handleError)

	const resetPasswordValidate = async (userId: number, token: string) => request
						.url(`${EP.resetPassword}?id=${userId}&token=${token}`)
						.get()
						.json(resetPasswordValidateCallback)
						.catch(handleError)

	const resetPassword = (form: ResetPasswordBodyType) => requestWithCookie.url(EP.resetPassword)
						.json(form)
						.post()
						.json(resetPasswordCallback)
						.catch(handleError)
	
	const logout = (token: string) => requestWithCookie.url(EP.logout)
							.auth(`Bearer ${token}`)
							.delete()
							.json(logoutCallback)
							.catch(handleError)

	const refreshToken = (token: string) => requestWithCookie.url(EP.refreshToken)
							.auth(`Bearer ${token}`)
							.post()
							.json(refreshTokenCallback)
							.catch(handleError)

	const validateToken = (token: string) => requestWithCookie.url(EP.validateToken)
							.auth(`Bearer ${token}`)
							.post()
							.json(validateTokenCallback)
							.catch(handleError)

	const fetchRooms = async (token: string, status?: number) => {
		const query = status === undefined ? "" : `?status=${status}`

		return await authFetch(EP.fetchRooms + query)
			.auth(`Bearer ${token}`)
			.get()
			.json(fetchRoomsCallback)
			.catch(handleError)
	}

	const createRoomCallback = (response: any) => {
		return response
	}

	const fetchRoomsCallback = (response: any) => {
		return response
	}

	const getRoomCallback = (response: any) => {
		return response
	}

	const getUserCallback = (response: any) => {
		return response
	}

	const joinRoomCallback = (response: any) => {
		return response
	}

	const leaveRoomCallback = (response: any) => {
		return response
	}

	const loginCallback = (response: any) => {
		return response
	}

	const registerCallback = (response: any) => {
		return response
	}

	const forgotPasswordCallback = (response: any) => {
		return response
	}

	const resetPasswordValidateCallback = (response: any) => {
		return response
	}

	const resetPasswordCallback = (response: any) => {
		return response
	}

	const logoutCallback = (response: any) => {
		return response
	}

	const refreshTokenCallback = (response: any) => {
		return response
	}

	const validateTokenCallback = (response: any) => {
		return response
	}
	
	const handleError = async (reason: any) => {
		if (reason?.json) {
			try {
				const body = await reason.json
				return {
					...body,
					status: reason.status
				}
			} catch {
				// fall through to generic error shape
			}
		}

		return JSON.parse(reason?.message || "{}")
	}

	return {
		authFetch,

		createRoom,
		getRoomById,
		getUserById,
		joinRoom,
		leaveRoom,
		login,
		logout,
		register,
		forgotPassword,
		resetPasswordValidate,
		resetPassword,
		fetchRooms,
		refreshToken,
		validateToken
	}
}
