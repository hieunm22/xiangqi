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
