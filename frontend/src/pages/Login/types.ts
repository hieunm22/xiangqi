export interface LoginBodyType {
	username: string
	password: string
	deviceName: string
	timezoneOffset: number
}

export interface LoginSuccessResponse {
	success: boolean
	message: string
	status_code: number
	access_token: string
	refresh_token: string
	token_type: string
}

export interface LoginErrorResponse {
  success: boolean
  message: string
  // status_code: number
}