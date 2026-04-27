export interface LoginRequest {
	username: string
	password: string
	timezoneOffset?: number
	deviceName?: string
}

export interface LoginResponse {
	success: boolean
	message: string
	status_code: number
	access_token: string
	refresh_token: string
	token_type: string
}

export interface LoginSession {
	userId: number
	deviceName: string
	clientId: string
	createdAt: string
	isValid: boolean
}
