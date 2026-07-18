import { useNavigate } from "react-router-dom"
import wretch, { WretchOptions } from "wretch"
import FormDataAddon from "wretch/addons/formData"
import { resolveBackendBaseUrl } from "common/backend-url"
import { LOGIN_PATH, LS_TOKEN_KEY } from "common/constant"
import { getLanguage, getToken } from "common/helper"
import { CreateRoomRequest } from "pages/Dashboard/types"
import {
	AuthResponse,
	FacebookLoginBodyType,
	GoogleLoginBodyType,
	LoginBodyType
} from "pages/Login/types"
import { ForgotPasswordBodyType } from "pages/LostPassword/types"
import { ResetPasswordBodyType, ResetPasswordValidateResponse } from "pages/ResetPassword/types"
import { APIResponse, APIResponseEmpty, UserAvatarType } from "types/Common"
import { Team } from "types/GameState"
import { PrivateChatMessage, PrivateConversation } from "components/ChatDialog/types"
import {
	Achievement,
	ChangePasswordBodyType,
	GameHistoryItem,
	SearchUserType,
	UpdateUserInfoPayload,
	UpdateUserInfoResponse,
	UnreadCountResponse,
	UserProfileWithStats
} from "components/Layout/types"
import { AnnouncementMessage } from "components/ChatDialog/types"
import {
	BonusCoins,
	DailyBonus,
	LuckySpins,
	SelectedTab
} from "pages/ExtraMoney/types"
import {
	BackToRoomRequest,
	GameMovements,
	MovePieceRequest,
	RoomInfo,
	RoomInfoData,
	RoomUser,
	VerifyStateRequest,
	VerifyStateResponseData,
	RoomWithUsers,
} from "pages/Room/types"

const EP = { // end points
	// auth endpoints
	changePassword: "/auth/change-password",
	facebookLink: "/auth/facebook-link",
	facebookLogin: "/auth/facebook",
	getUser: "/auth/user",
	getUserInfo: "/auth/user-info",
	googleLogin: "/auth/google",
	linkedProviders: "/auth/linked-providers",
	login: "/auth/login",
	logout: "/auth/logout",
	refreshToken: "/auth/refresh-token",
	register: "/auth/register",
	validateToken: "/auth/validate-token",
	forgotPassword: "/auth/forgot-password",
	resetPassword: "/auth/reset-password",

	// user endpoints
	getAchievements: "/user/achievements",
	getLeaderboard: "/user/leaderboard",
	bonusCoins: "/user/bonus-coins",
	claimBonusCoin: "/user/bonus-coins-claim",
	dailyBonus: "/user/daily-bonus",
	claimDailyBonus: "/user/daily-bonus-claim",
	getLuckySpins: "/user/lucky-spins",
	claimLuckySpins: "/user/lucky-spins-claim",
	spinLuckyWheel: "/user/lucky-spin",
	searchUsers: "/user/search",
	selectedTab: "/user/selected-tab",
	updateUserInfo: "/user/update-info",

	// room endpoints
	createRoom: "/room/create-room",
	fetchRooms: "/room/fetch-rooms",
	getRoomInfo: "/room/info",
	joinRoom: "/room/join",
	kickRoom: "/room/kick",
	leaveRoom: "/room/leave",
	startRoom: "/room/start",
	updateRoom: "/room/update",

	// game endpoints
	backToRoom: "/game/back-to-room",
	changeTeam: "/game/change-team",
	drawGame: "/game/draw-game",
	getGameMovementHistory: "/game/movement-history",
	movePiece: "/game/move-piece",
	getOnlineUsers: "/game/online",
	getPlayerHistory: "/game/player-history",
	surrenderGame: "/game/surrender",
	undoGame: "/game/undo",
	verifyState: "/game/verify-state",

	// message endpoints
	getAnnouncement: "/message/get-announcement",
	getPrivateConversations: "/message/get-private-conversations",
	getPrivateMessages: "/message/get-private",
	getRoomMessages: "/message/get-room-message",
	markAnnouncementAsRead: "/message/mark-announcement-as-read",
	markPrivateMessageAsRead: "/message/mark-private-message-as-read",
	markRoomMessageAsRead: "/message/mark-room-as-read",
	sendAnnouncement: "/message/send-announcement",
	sendPrivateMessage: "/message/send-private",
	sendRoomMessage: "/message/send-room-message",
	unreadCount: "/message/unread-count",

	// tool endpoints
	makeExpired: "/tool/make-expired",
	resetGame: "/tool/reset-game",
}

// shared across all useAPI() instances so concurrent 401s trigger a single refresh
let refreshPromise: Promise<string> | null = null

export const useAPI = () => {
	const navigate = useNavigate()
	const CLIENT_BASE_URL = `${resolveBackendBaseUrl()}/api`
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

	const refreshAccessToken = async (currentToken: string) => {
		// single-flight: concurrent 401s await the same refresh instead of calling it again
		if (!refreshPromise) {
			refreshPromise = (async () => {
				const response: AuthResponse = await requestWithCookie
					.auth(`Bearer ${currentToken}`)
					.url(EP.refreshToken)
					.options(wretchOptions)
					.post() // refresh token should get from cookie from backend
					.json()

				localStorage.setItem(LS_TOKEN_KEY, response.access_token)
				return response.access_token
			})().finally(() => {
				// reset so a later expiry can refresh again
				refreshPromise = null
			})
		}

		return refreshPromise
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
					return request
						.auth(`Bearer ${newToken}`)
						.headers({ "skip-auth": "true" })
						.fetch()
						.json(r => r)
				} catch (err: any) {
					// console.error("Token refresh failed", err.message)
					localStorage.removeItem(LS_TOKEN_KEY)
					navigate(LOGIN_PATH)
					throw err
				}
			})
	}

	// ---------- API methods ----------

	const backToRoom = async (token: string, body: BackToRoomRequest) => authFetch(EP.backToRoom)
							.auth(`Bearer ${token}`)
							.post(body)
							.json(backToRoomCallback)
							.catch(handleError)

	const changePassword = async (token: string, form: ChangePasswordBodyType) => authFetch(EP.changePassword)
							.auth(`Bearer ${token}`)
							.post(form)
							.json(changePasswordCallback)
							.catch(handleError)

	const changeTeam = async (token: string, roomId: number, isLeaveToSeat: boolean) => authFetch(EP.changeTeam)
							.auth(`Bearer ${token}`)
							.post({ roomId, isLeaveToSeat })
							.json(changeTeamCallback)
							.catch(handleError)

	const claimBonusCoin = async (token: string) => authFetch(EP.claimBonusCoin)
							.auth(`Bearer ${token}`)
							.post()
							.json(claimBonusCoinCallback)
							.catch(handleError)

	const claimDailyBonus = async (token: string, double: boolean) => authFetch(EP.claimDailyBonus)
							.auth(`Bearer ${token}`)
							.post({ double })
							.json(claimDailyBonusCallback)
							.catch(handleError)

	const claimLuckySpins = async (token: string) => authFetch(EP.claimLuckySpins)
							.auth(`Bearer ${token}`)
							.post()
							.json(claimLuckySpinsCallback)
							.catch(handleError)

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

	const facebookLink = async (token: string, fbAccessToken: string) => authFetch(EP.facebookLink)
							.auth(`Bearer ${token}`)
							.post({ accessToken: fbAccessToken })
							.json(facebookLinkCallback)
							.catch(handleError)

	const facebookLogin = (form: FacebookLoginBodyType) => requestWithCookie.url(EP.facebookLogin)
							.json(form)
							.post()
							.json(facebookLoginCallback)
							.catch(handleError)

	const facebookUnlink = async (token: string) => authFetch(EP.facebookLink)
							.auth(`Bearer ${token}`)
							.delete()
							.json(facebookUnlinkCallback)
							.catch(handleError)

	const fetchRooms = async (token: string, status?: number) => {
		const query = status === undefined ? "" : `?status=${status}`

		return await authFetch(EP.fetchRooms + query)
							.auth(`Bearer ${token}`)
							.get()
							.json(fetchRoomsCallback)
							.catch(handleError)
	}

	const forgotPassword = (form: ForgotPasswordBodyType) => requestWithCookie.url(EP.forgotPassword)
							.json(form)
							.post()
							.json(forgotPasswordCallback)
							.catch(handleError)

	const getAchievements = async (token: string, userId: number) => authFetch(`${EP.getAchievements}?userId=${userId}`)
							.auth(`Bearer ${token}`)
							.get()
							.json(getAchievementsCallback)
							.catch(handleError)

	const getAnnouncements = async (token: string) => authFetch(EP.getAnnouncement)
							.auth(`Bearer ${token}`)
							.get()
							.json(getAnnouncementsCallback)
							.catch(handleError)

	const getAnnouncementsMore = async (token: string, before: string) => authFetch(EP.getAnnouncement)
							.auth(`Bearer ${token}`)
							.headers({ "before": before })
							.get()
							.json(getAnnouncementsCallback)
							.catch(handleError)

	const getBonusCoins = async (token: string) => authFetch(EP.bonusCoins)
							.auth(`Bearer ${token}`)
							.get()
							.json(getBonusCoinsCallback)
							.catch(handleError)

	const getDailyBonus = async (token: string) => authFetch(EP.dailyBonus)
							.auth(`Bearer ${token}`)
							.get()
							.json(getDailyBonusCallback)
							.catch(handleError)

	const getGameMovementHistory = async (token: string, gameId: string) => authFetch(`${EP.getGameMovementHistory}?gameId=${gameId}`)
							.auth(`Bearer ${token}`)
							.get()
							.json(getGameHistoryCallback)
							.catch(handleError)

	const getLeaderboard = async (token: string, offset: number, limit: number) => authFetch(`${EP.getLeaderboard}?offset=${offset}&limit=${limit}`)
							.auth(`Bearer ${token}`)
							.get()
							.json(getLeaderboardCallback)
							.catch(handleError)

	const getLinkedProviders = async (token: string) => authFetch(EP.linkedProviders)
							.auth(`Bearer ${token}`)
							.get()
							.json(getLinkedProvidersCallback)
							.catch(handleError)

	const getLuckySpins = async (token: string) => authFetch(EP.getLuckySpins)
							.auth(`Bearer ${token}`)
							.get()
							.json(getLuckySpinsCallback)
							.catch(handleError)

	const getOnlineUsers = async (token: string) => authFetch(EP.getOnlineUsers)
							.auth(`Bearer ${token}`)
							.get()
							.json(getOnlineUsersCallback)
							.catch(handleError)

	const getPlayerHistory = async (token: string, userId: number) => authFetch(`${EP.getPlayerHistory}?userId=${userId}`)
							.auth(`Bearer ${token}`)
							.get()
							.json(getPlayerHistoryCallback)
							.catch(handleError)

	const getRoomById = async (token: string, roomId: number) => authFetch(`${EP.getRoomInfo}?id=${roomId}`)
							.auth(`Bearer ${token}`)
							.get()
							.json(getRoomCallback)
							.catch(handleError)

	const getPrivateConversations = async (token: string) => authFetch(EP.getPrivateConversations)
							.auth(`Bearer ${token}`)
							.get()
							.json(getPrivateConversationsCallback)
							.catch(handleError)

	const getPrivateMessages = async (token: string, receiverId: number) => authFetch(`${EP.getPrivateMessages}?receiver_id=${receiverId}`)
							.auth(`Bearer ${token}`)
							.get()
							.json(getPrivateMessagesCallback)
							.catch(handleError)

	const getRoomMessages = async (token: string, roomId: number) => authFetch(`${EP.getRoomMessages}?roomId=${roomId}`)
							.auth(`Bearer ${token}`)
							.get()
							.json(getRoomMessagesCallback)
							.catch(handleError)

	const getSelectedTab = async (token: string) => authFetch(EP.selectedTab)
							.auth(`Bearer ${token}`)
							.get()
							.json(getSelectedTabCallback)
							.catch(handleError)

	const getUnreadCount = async (token: string) => authFetch(EP.unreadCount)
							.auth(`Bearer ${token}`)
							.get()
							.json(getUnreadCountCallback)
							.catch(handleError)

	const getUserById = async (token: string, userId: number) => authFetch(`${EP.getUser}?id=${userId}`)
							.auth(`Bearer ${token}`)
							.get()
							.json(getUserCallback)
							.catch(handleError)

	const googleLogin = (form: GoogleLoginBodyType) => requestWithCookie.url(EP.googleLogin)
							.json(form)
							.post()
							.json(googleLoginCallback)
							.catch(handleError)

	const joinRoom = async (token: string, roomId: number, team?: Team | null) => authFetch(EP.joinRoom)
							.auth(`Bearer ${token}`)
							.post(team === undefined ? { id: roomId } : { id: roomId, team })
							.json(joinRoomCallback)
							.catch(handleError)

	const kickUser = async (token: string, roomId: number, userId: number) => authFetch(EP.kickRoom)
							.auth(`Bearer ${token}`)
							.post({ id: roomId, userId })
							.json(kickUserCallback)
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

	const makeExpired = (token: string) => requestWithCookie.url(EP.makeExpired)
							.auth(`Bearer ${token}`)
							.options(wretchOptions)
							.post()
							.text(makeExpiredCallback)
							.catch(handleError)
							
	const markAnnouncementAsRead = async (token: string) => authFetch(EP.markAnnouncementAsRead)
							.auth(`Bearer ${token}`)
							.post()
							.json(markAnnouncementAsReadCallback)
							.catch(handleError)

	const markPrivateMessageAsRead = async (token: string, receiverId: number) => authFetch(EP.markPrivateMessageAsRead)
							.auth(`Bearer ${token}`)
							.post({ receiver_id: receiverId })
							.json(markPrivateMessageAsReadCallback)
							.catch(handleError)

	const markRoomMessageAsRead = async (token: string, roomId: number) => authFetch(EP.markRoomMessageAsRead)
							.auth(`Bearer ${token}`)
							.post({ room_id: roomId })
							.json(markRoomMessageAsReadCallback)
							.catch(handleError)

	const movePiece = async (token: string, body: MovePieceRequest) => authFetch(EP.movePiece)
							.auth(`Bearer ${token}`)
							.post(body)
							.json(movePieceCallback)
							.catch(handleError)

	const refreshToken = (token: string) => requestWithCookie.url(EP.refreshToken)
							.auth(`Bearer ${token}`)
							.post()
							.json(refreshTokenCallback)
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

	const searchUsers = async (token: string, query: string, roomId: number | null) => authFetch(`${EP.searchUsers}?query=${encodeURIComponent(query)}${roomId ? `&roomId=${roomId}` : ""}`)
							.auth(`Bearer ${token}`)
							.get()
							.json(searchUsersCallback)
							.catch(handleError)

	const sendAnnouncement = async (token: string, message: string) => authFetch(EP.sendAnnouncement)
							.auth(`Bearer ${token}`)
							.post({ message })
							.json(sendAnnouncementCallback)
							.catch(handleError)

	const sendPrivateMessage = async (token: string, receiverId: number, message: string) => authFetch(EP.sendPrivateMessage)
							.auth(`Bearer ${token}`)
							.post({ message, receiver_id: receiverId })
							.json(sendPrivateMessageCallback)
							.catch(handleError)

	const sendRoomMessage = async (token: string, roomId: number, message: string) => authFetch(EP.sendRoomMessage)
							.auth(`Bearer ${token}`)
							.post({ message, room_id: roomId })
							.json(sendRoomMessageCallback)
							.catch(handleError)

	const spinLuckyWheel = async (token: string, amount: number) => authFetch(EP.spinLuckyWheel)
							.auth(`Bearer ${token}`)
							.post({ amount })
							.json(spinLuckyWheelCallback)
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

	const undoGame = async (token: string, gameId: string) => authFetch(EP.undoGame)
							.auth(`Bearer ${token}`)
							.post({ gameId })
							.json(undoGameCallback)
							.catch(handleError)

	const updateRoom = async (token: string, roomId: number, name: string) => authFetch(EP.updateRoom)
							.auth(`Bearer ${token}`)
							.patch({ id: roomId, name })
							.json(updateRoomCallback)
							.catch(handleError)

	const updateSelectedTab = async (token: string, tab: number) => authFetch(EP.selectedTab)
							.auth(`Bearer ${token}`)
							.patch({ tab })
							.json(updateSelectedTabCallback)
							.catch(handleError)

	const updateUserInfo = async (token: string, payload: Partial<UpdateUserInfoPayload>) => authFetch(EP.updateUserInfo)
							.auth(`Bearer ${token}`)
							.patch(payload)
							.json(updateUserInfoCallback)
							.catch(handleError)

	const updateUserAvatar = async (token: string, avatar: File) => requestWithCookie
							.url(EP.updateUserInfo)
							.auth(`Bearer ${token}`)
							.addon(FormDataAddon)
							.formData({ avatar })
							.patch()
							.json(updateUserInfoCallback)
							.catch(handleError)

	const validateToken = (token: string) => authFetch(EP.validateToken)
							.auth(`Bearer ${token}`)
							.post()
							.json(validateTokenCallback)
							.catch(handleError)

	const verifyGameState = async (token: string, body: VerifyStateRequest) => authFetch(EP.verifyState)
							.auth(`Bearer ${token}`)
							.post(body)
							.json(verifyGameStateCallback)
							.catch(handleError)

	// ---------- Callbacks ----------

	const backToRoomCallback = (response: APIResponseEmpty) => {
		return response
	}

	const changePasswordCallback = (response: APIResponseEmpty) => {
		return response
	}

	const changeTeamCallback = (response: APIResponse<RoomUser[]>) => {
		return response
	}

	const claimBonusCoinCallback = (response: APIResponse<BonusCoins>) => {
		return response
	}

	const claimDailyBonusCallback = (response: APIResponse<DailyBonus>) => {
		return response
	}

	const claimLuckySpinsCallback = (response: APIResponse<LuckySpins>) => {
		return response
	}

	const createRoomCallback = (response: APIResponse<RoomWithUsers>) => {
		return response
	}

	const drawGameCallback = (response: APIResponseEmpty) => {
		return response
	}

	const facebookLinkCallback = (response: APIResponseEmpty) => {
		return response
	}

	const facebookLoginCallback = (response: AuthResponse) => {
		return response
	}

	const facebookUnlinkCallback = (response: APIResponseEmpty) => {
		return response
	}

	const getAchievementsCallback = (response: APIResponse<Achievement[]>) => {
		return response
	}

	const getAnnouncementsCallback = (response: APIResponse<AnnouncementMessage[]>) => {
		return response
	}

	const getLeaderboardCallback = (response: APIResponse<SearchUserType[]>) => {
		return response
	}

	const getLinkedProvidersCallback = (response: APIResponse<{ providers: string[] }>) => {
		return response
	}

	const getBonusCoinsCallback = (response: APIResponse<BonusCoins>) => {
		return response
	}

	const getDailyBonusCallback = (response: APIResponse<DailyBonus>) => {
		return response
	}
	
	const fetchRoomsCallback = (response: APIResponse<RoomInfoData>) => {
		return response
	}
	
	const forgotPasswordCallback = (response: any) => {
		return response
	}
	
	const getGameHistoryCallback = (response: APIResponse<GameMovements[]>) => {
		return response
	}
	
	const getLuckySpinsCallback = (response: APIResponse<LuckySpins>) => {
		return response
	}

	const getOnlineUsersCallback = (response: APIResponse<{ count: number; users: UserAvatarType[] }>) => {
		return response
	}

	const getPlayerHistoryCallback = (response: APIResponse<GameHistoryItem[]>) => {
		return response
	}
	
	const getPrivateConversationsCallback = (response: APIResponse<PrivateConversation[]>) => {
		return response
	}
	
	const getPrivateMessagesCallback = (response: APIResponse<PrivateChatMessage[]>) => {
		return response
	}
	
	const getRoomCallback = (response: APIResponse<RoomInfoData>) => {
		return response
	}
	
	const getRoomMessagesCallback = (response: any) => {
		return response
	}

	const getSelectedTabCallback = (response: APIResponse<SelectedTab>) => {
		return response
	}

	const getUserCallback = (response: APIResponse<UserProfileWithStats>) => {
		return response
	}
	
	const getUnreadCountCallback = (response: APIResponse<UnreadCountResponse>) => {
		return response
	}

	const googleLoginCallback = (response: AuthResponse) => {
		return response
	}

	const joinRoomCallback = (response: APIResponse<RoomUser[]>) => {
		return response
	}
	
	const kickUserCallback = (response: any) => {
		return response
	}
	
	const leaveRoomCallback = (response: APIResponseEmpty) => {
		return response
	}

	const loginCallback = (response: AuthResponse) => {
		return response
	}
	
	const logoutCallback = (response: APIResponseEmpty) => {
		return response
	}
	
	const makeExpiredCallback = (accessToken: string) => {
		return accessToken
	}
	
	const markAnnouncementAsReadCallback = (response: APIResponseEmpty) => {
		return response
	}

	const markPrivateMessageAsReadCallback = (response: APIResponseEmpty) => {
		return response
	}

	const markRoomMessageAsReadCallback = (response: APIResponseEmpty) => {
		return response
	}
	
	const movePieceCallback = (response: APIResponse<GameMovements>) => {
		return response
	}

	const registerCallback = (response: AuthResponse) => {
		return response
	}

	const resetPasswordValidateCallback = (response: ResetPasswordValidateResponse) => {
		return response
	}

	const resetPasswordCallback = (response: any) => {
		return response
	}

	const refreshTokenCallback = (response: AuthResponse) => {
		return response
	}

	const resetGameCallback = (response: any) => {
		return response
	}

	const searchUsersCallback = (response: APIResponse<UserAvatarType[]>) => {
		return response
	}

	const sendPrivateMessageCallback = (response: APIResponse<PrivateChatMessage>) => {
		return response
	}

	const sendRoomMessageCallback = (response: any) => {
		return response
	}

	const sendAnnouncementCallback = (response: APIResponse<AnnouncementMessage>) => {
		return response
	}

	const spinLuckyWheelCallback = (response: APIResponse<LuckySpins>) => {
		return response
	}

	const startRoomCallback = (response: APIResponse<Pick<RoomInfoData, "room" | "game">>) => {
		return response
	}

	const surrenderGameCallback = (response: APIResponseEmpty) => {
		return response
	}

	const undoGameCallback = (response: APIResponse<GameMovements[]>) => {
		return response
	}

	const updateRoomCallback = (response: APIResponse<RoomInfo>) => {
		return response
	}

	const updateSelectedTabCallback = (response: APIResponse<SelectedTab>) => {
		return response
	}

	const updateUserInfoCallback = (response: APIResponse<UpdateUserInfoResponse>) => {
		return response
	}

	const validateTokenCallback = (response: APIResponseEmpty) => {
		return response
	}

	const verifyGameStateCallback = (response: APIResponse<VerifyStateResponseData>) => {
		return response
	}

	// ---------- error handler ----------
	
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

		backToRoom,
		changePassword,
		changeTeam,
		claimBonusCoin,
		claimDailyBonus,
		claimLuckySpins,
		createRoom,
		drawGame,
		facebookLink,
		facebookLogin,
		facebookUnlink,
		fetchRooms,
		forgotPassword,
		getAchievements,
		getAnnouncements,
		getAnnouncementsMore,
		getBonusCoins,
		getDailyBonus,
		getGameMovementHistory,
		getLeaderboard,
		getLinkedProviders,
		getLuckySpins,
		getOnlineUsers,
		getPlayerHistory,
		getPrivateConversations,
		getPrivateMessages,
		getRoomMessages,
		getRoomById,
		getSelectedTab,
		getUnreadCount,
		getUserById,
		googleLogin,
		joinRoom,
		kickUser,
		leaveRoom,
		login,
		logout,
		makeExpired,
		markAnnouncementAsRead,
		markPrivateMessageAsRead,
		markRoomMessageAsRead,
		movePiece,
		register,
		refreshToken,
		resetGame,
		resetPasswordValidate,
		resetPassword,
		searchUsers,
		sendAnnouncement,
		sendPrivateMessage,
		sendRoomMessage,
		spinLuckyWheel,
		startRoom,
		surrenderGame,
		undoGame,
		updateRoom,
		updateSelectedTab,
		updateUserAvatar,
		updateUserInfo,
		validateToken,
		verifyGameState,
	}
}
