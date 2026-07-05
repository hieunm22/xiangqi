export interface LoginRequest {
	username: string
	password: string
	timezoneOffset: number
	deviceName: string
}

export interface LoginSuccessResponse {
	success: boolean
	message: string
	status_code: number
	access_token: string
	refresh_token: string
	token_type: string
}

export interface GoogleLoginRequest {
	credential: string
	timezoneOffset: number
	deviceName: string
}

export interface FacebookLoginRequest {
	accessToken: string
	timezoneOffset: number
	deviceName: string
}

export interface FacebookLinkRequest {
	accessToken: string
}

export interface LoginSession {
	userId: number
	deviceName: string
	clientId: string
	createdAt: string
	isValid: boolean
}

export interface RegisterRequest {
	username: string
	user_name: string
	password: string
	gender: boolean | string | number
	displayName: string
	display_name: string
	email: string
}

export interface ForgotPasswordRequest {
	email: string
}

export type DuplicateCheckResult = {
	username_exists: boolean
	email_exists: boolean
}

export type CreatedUserRow = {
	id: bigint
	user_name: string
	email: string
	display_name: string
	gender: boolean
	avatar_seq: number
}

export type ResetPasswordRequest = {
	userId: number
	password: string
}

export type ChangePasswordRequest = {
	currentPassword: string
	newPassword: string
}
