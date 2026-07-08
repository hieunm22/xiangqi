import { PresenceStatus } from "common/presence"

export type Team = "red" | "black"

export interface ChangeTeamRequest {
	roomId: number
	isLeaveToSeat: boolean
}

export type GameStateStatus = "ongoing" | "check" | "checkmate" | "stalemate"

export interface VerifyStateRequestDto {
	gameId: string
	newFen: string
	checkedTeam: Team
}

export interface BackToRoomRequest {
	roomId: number
	gameId: string
}

export interface MovePieceRequest {
	gameId: string
	newFen: string
	capturePiece: string | null
	team: Team
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

export interface UserPresenceStatus {
	userId: number
	status: PresenceStatus
}

export interface PostGameParticipant {
	team: Team
	ready: boolean
	userId: number
}

export interface PostGameLockState {
	deadlineAt: number
	gameId: string
	participants: Map<number, PostGameParticipant>
	timer: NodeJS.Timeout | null
}

interface PostGameTimeoutParams {
	roomId: number
	gameId: string
	notReadyUserIds: number[]
}

export interface StartPostGameLockParams {
	roomId: number
	gameId: string
	participants: Array<Pick<PostGameParticipant, "team" | "userId">>
	onTimeout: (params: PostGameTimeoutParams) => Promise<void>
}

export interface RoomUserSnapshot {
	joined_at: Date
	team: string | null
	users: {
		avatar_seq: number
		display_name: string
		id: bigint
		is_bot: boolean
		total_amount: number
	}
}
