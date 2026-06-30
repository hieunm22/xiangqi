export interface Users {
	id: number
	user_name: string
	email: string
	display_name: string
	gender: boolean
	avatar_seq: number
	avatar_url: string
	total_amount: number
}

export interface GameInfo {
	id: string
	room_id: number
	winner_id: number | null
	status: number
	bot_difficulty: number | null
}
