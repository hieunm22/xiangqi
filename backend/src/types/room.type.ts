import { Team } from "./game.type"

export interface CreateRoomRequest {
	tableName: string
	teamName: string | null
	redFirst: boolean
	pveMode: boolean
	betAmount: number
	timeLimit?: number | null
	timeIncrement?: number | null
	timePerMove?: number | null
}

export enum RoomStatus {
	Waiting = 1,
	Playing = 2
}

interface RoomRequestBase {
	id: number
}

export type JoinRoomTeam = Team | null

export interface JoinRoomRequest extends RoomRequestBase {
	team?: JoinRoomTeam
}

export interface LeaveRoomRequest extends RoomRequestBase { }

export interface KickUserRequest extends RoomRequestBase {
	userId: number
}

export interface SetRoomStatusRequest extends RoomRequestBase {
	status: RoomStatus
}

export interface StartGameRequest extends RoomRequestBase {
	botDifficulty?: number
}
