import { useNavigate } from "react-router-dom"
import wretch, { WretchOptions } from "wretch"
import FormDataAddon from "wretch/addons/formData"
import { LOGIN_PATH, LS_TOKEN_KEY } from "common/constant"
import { getLanguage, getToken } from "common/helper"
import { CreateRoomRequest } from "pages/Dashboard/types"
import { LoginBodyType, LoginSuccessResponse } from "pages/Login/types"
import { ForgotPasswordBodyType } from "pages/LostPassword/types"
import { ResetPasswordBodyType } from "pages/ResetPassword/types"
import { APIResponse } from "types/Common"
import { Users } from "types/Entities"
import { MovePieceRequest } from "pages/Room/types"

const EP = { // end points
	// auth endpoints
	getUser: "/auth/user",
	login: "/auth/login",
	logout: "/auth/logout",
	makeExpired: "/auth/make-expired",
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
	startRoom: "/room/start",
	updateRoom: "/room/update",

	// game endpoints
	getGameHistory: "/game/history",
	movePiece: "/game/move-piece",
	drawGame: "/game/draw-game",
	surrenderGame: "/game/surrender",

	// tool endpoints
	resetGame: "/tool/reset-game",
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
				} catch (err: any) {
					console.error("Token refresh failed", err.message)
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

	const drawGame = async (token: string, gameId: string) => authFetch(EP.drawGame)
						.auth(`Bearer ${token}`)
						.post({ gameId })
						.json(drawGameCallback)
						.catch(handleError)

	const forgotPassword = (form: ForgotPasswordBodyType) => requestWithCookie.url(EP.forgotPassword)
							.json(form)
							.post()
							.json(forgotPasswordCallback)
							.catch(handleError)

	const getGameHistory = async (token: string, gameId: string) => authFetch(`${EP.getGameHistory}?gameId=${gameId}`)
							.auth(`Bearer ${token}`)
							.get()
							.json(getGameHistoryCallback)
							.catch(handleError)

	const getUserById = async (userId: number) => request.url(`${EP.getUser}?id=${userId}`)
							.get()
							.json(getUserCallback)
							.catch(handleError)

	const getRoomById = async (token: string, roomId: number) => authFetch(`${EP.getRoomInfo}?id=${roomId}`)
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
	
	const logout = (token: string) => requestWithCookie.url(EP.logout)
							.auth(`Bearer ${token}`)
							.delete()
							.json(logoutCallback)
							.catch(handleError)

	const movePiece = async (token: string, body: MovePieceRequest) => authFetch(EP.movePiece)
							.auth(`Bearer ${token}`)
							.post(body)
							.json(movePieceCallback)
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

	const refreshToken = (token: string) => requestWithCookie.url(EP.refreshToken)
							.auth(`Bearer ${token}`)
							.post()
							.json(refreshTokenCallback)
							.catch(handleError)

	const makeExpired = (token: string) => requestWithCookie.url(EP.makeExpired)
							.auth(`Bearer ${token}`)
							.options(wretchOptions)
							.post()
							.text(makeExpiredCallback)
							.catch(handleError)

	const register = (form: any) => requestWithCookie.url(EP.register)
							.json(form)
							.post()
							.json(registerCallback)
							.catch(handleError)

	const resetGame = async (token: string, roomId: number) => authFetch(EP.resetGame)
							.auth(`Bearer ${token}`)
							.post({ roomId })
							.json(resetGameCallback)
							.catch(handleError)

	const startRoom = async (token: string, roomId: number, botDifficulty?: number) => authFetch(EP.startRoom)
							.auth(`Bearer ${token}`)
							.post(botDifficulty !== undefined ? { id: roomId, botDifficulty } : { id: roomId })
							.json(startRoomCallback)
							.catch(handleError)

	const surrenderGame = async (token: string, gameId: string) => authFetch(EP.surrenderGame)
							.auth(`Bearer ${token}`)
							.post({ gameId })
							.json(surrenderGameCallback)
							.catch(handleError)

	const updateRoom = async (token: string, roomId: number, name: string) => authFetch(EP.updateRoom)
							.auth(`Bearer ${token}`)
							.patch({ id: roomId, name })
							.json(updateRoomCallback)
							.catch(handleError)

	const validateToken = (token: string) => authFetch(EP.validateToken)
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

	const drawGameCallback = (response: any) => {
		return response
	}

	const fetchRoomsCallback = (response: any) => {
		return response
	}

	const forgotPasswordCallback = (response: any) => {
		return response
	}

	const getGameHistoryCallback = (response: any) => {
		return response
	}

	const getRoomCallback = (response: any) => {
		return response
	}

	const getUserCallback = (response: APIResponse<Users>) => {
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

	const makeExpiredCallback = (accessToken: string) => {
		return accessToken
	}

	const registerCallback = (response: any) => {
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

	const movePieceCallback = (response: any) => {
		return response
	}

	const refreshTokenCallback = (response: any) => {
		return response
	}

	const resetGameCallback = (response: any) => {
		return response
	}

	const startRoomCallback = (response: any) => {
		return response
	}

	const surrenderGameCallback = (response: any) => {
		return response
	}

	const updateRoomCallback = (response: any) => {
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
		drawGame,
		fetchRooms,
		forgotPassword,
		getGameHistory,
		getRoomById,
		getUserById,
		joinRoom,
		leaveRoom,
		login,
		logout,
		makeExpired,
		movePiece,
		register,
		refreshToken,
		resetGame,
		resetPasswordValidate,
		resetPassword,
		startRoom,
		surrenderGame,
		updateRoom,
		validateToken
	}
}
