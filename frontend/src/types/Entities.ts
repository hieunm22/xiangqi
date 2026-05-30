export interface Users {
	id: number
	user_name: string
	email: string
	display_name: string
	gender: boolean
	avatar_url: string
}

export interface GameInfo {
	id: string
	room_id: number
	winner_id: number | null
	status: number
	bot_difficulty: number | null
}
