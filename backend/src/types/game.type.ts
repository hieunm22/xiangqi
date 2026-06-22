export interface ChangeTeamRequest {
	roomId: number
	isLeaveToSeat: boolean
}

export interface MovePieceRequest {
	gameId: string
	newFen: string
	capturePiece: string | null
	team: "red" | "black"
}

export interface SurrenderGameRequest {
	gameId: string
}

export interface DrawGameRequest {
	gameId: string
}

export interface PVEContext {
	roomId: bigint
	redFirst: boolean
	botDifficulty: number
}

export interface RequestBotMoveParams {
	gameId: string
	projectFen: string
	redFirst: boolean
	botTeam: "red" | "black"
	difficulty: number
}

export interface BotMoveResult {
	uci: string
	newFen: string
	capturePiece: string | null
}

export interface EndGameParams {
	gameId: string
	roomId: bigint
	winnerId: bigint | null
	isBotGame: boolean
	betAmount: number | null
}
