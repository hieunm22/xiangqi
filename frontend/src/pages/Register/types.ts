export interface RegisterBodyType {
	username: string
	password: string
	confirmPassword: string
	gender: string
	displayName: string
	email: string
}

export interface RegisterSuccessResponse {
	success: boolean
	message: string
	status_code: number
	access_token: string
	refresh_token: string
	token_type: string
}

export interface RegisterErrorResponse {
	success: boolean
	message: string
}
