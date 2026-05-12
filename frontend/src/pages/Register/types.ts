export interface RegisterBodyType {
	username: string
	password: string
	email: string
	gender: string
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
