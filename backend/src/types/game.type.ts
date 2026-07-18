import { PresenceStatus } from "common/presence"

export type Team = "red" | "black"

export interface ChangeTeamRequest {
	roomId: number
	isLeaveToSeat: boolean
}

export type GameStateStatus = "ongoing" | "check" | "checkmate" | "stalemate"

export type GameEndReason =
	| "checkmate"
	| "stalemate"
	| "perpetual-check"
	| "timeout"
	| "per-move-timeout"
	| "surrender"
	| "leave"
	| "draw"

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
	botTeam: Team
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
	endReason: GameEndReason
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
	timeLimit: number | null
	timeIncrement: number
	timePerMove: number
	betAmount: number | null
	pveMode: boolean
	participants: ClockParticipant[]
}

// Clock baseline: accumulated time (ms) and move counts at a fixed point.
// Stamped on the record an undo rewinds to, so the resumed turn doesn't re-charge undone time.
export interface ClockBaseline {
	spentMs: { red: number; black: number }
	moves: { red: number; black: number }
}

// Move-history record fields used by the clock.
// `baseline` marks a resume anchor: only gaps after it are added to the baseline's accumulated time.
export interface ClockHistoryRecord {
	team: Team
	timeStamp: number
	fen: string
	baseline?: ClockBaseline | null
}

// Derived clock math, including the active team's flag deadline (ms epoch).
export interface ClockState {
	redMs: number
	blackMs: number
	activeTeam: Team
	// active team's remaining time for the CURRENT move
	perMoveRemainingMs: number
	deadlineMs: number
	perMoveBinding: boolean
	serverNow: number
}

// Clock payload broadcast to / loaded by clients. `serverNow` lets clients
// correct for clock skew when ticking locally between updates.
export interface ClockSnapshot {
	redMs: number
	blackMs: number
	activeTeam: Team
	// Active team's remaining time for the current move
	perMoveRemainingMs: number
	serverNow: number
	timeLimit: number
	timeIncrement: number
	timePerMove: number
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
