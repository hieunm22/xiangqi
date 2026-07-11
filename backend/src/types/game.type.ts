import { PresenceStatus } from "common/presence"

export type Team = "red" | "black" | "white"

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
	// Variant team ("red"/"black" for xiangqi, "white"/"black" for chess);
	// validated against the game's variant at the route.
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

// ---- Game clock (countdown / chess clock) ----

export interface ClockParticipant {
	userId: number
	team: Team | null
}

// Per-game clock configuration plus the participants needed to settle a time-out.
export interface ClockConfig {
	status: number
	roomId: bigint
	gameType: string
	timeLimit: number | null
	timeIncrement: number
	betAmount: number | null
	pveMode: boolean
	participants: ClockParticipant[]
}

// Accumulated time (ms) and completed-move counts per side at a fixed point in
// the game. Written onto the move-history record that an undo rewinds to, so the
// clock can resume the current turn from "now" without re-charging the wall-clock
// time the undo removed.
export interface ClockBaseline {
	spentMs: { red: number; black: number }
	moves: { red: number; black: number }
}

// A single move-history record reduced to the fields the clock derives from.
// `baseline`, when present, marks this record as a resume anchor: time spent up
// to here is taken from the baseline and only later gaps are added on top.
export interface ClockHistoryRecord {
	team: Team
	timeStamp: number
	fen: string
	baseline?: ClockBaseline | null
}

// Derived clock math, including the active team's flag deadline (ms epoch).
// `blackMs` is the "black" seat's time; `redMs` is the other seat's - red in
// xiangqi, white in chess. Both variants always have a black seat, so this two-
// slot shape covers them without a per-variant map.
export interface ClockState {
	redMs: number
	blackMs: number
	activeTeam: Team
	deadlineMs: number
	serverNow: number
}

// Clock payload broadcast to / loaded by clients. `serverNow` lets clients
// correct for clock skew when ticking locally between updates.
export interface ClockSnapshot {
	redMs: number
	blackMs: number
	activeTeam: Team
	serverNow: number
	timeLimit: number
	timeIncrement: number
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

export interface CachedAchievement {
	id: bigint
	name: string
}
