export interface RegisterBodyType {
	username: string
	password: string
	confirmPassword: string
	gender: string
	displayName: string
	email: string
}

export interface RegisterErrorResponse {
	success: boolean
	message: string
}
