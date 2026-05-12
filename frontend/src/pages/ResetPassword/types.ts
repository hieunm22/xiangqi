export interface ResetPasswordBodyType {
	userId: number
	password: string
}

export interface ResetPasswordValidateResponse {
	success: boolean
	message: string
	status_code: number
	data: {
		id: number
		user_name: string
		email: string
		display_name: string
		gender: boolean
	} | null
}

export interface ResetPasswordSuccessResponse {
	success: boolean
	message: string
	status_code: number
}
