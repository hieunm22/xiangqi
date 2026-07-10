import { DashboardRoom } from "../types"

// Registered by JoinRoomDialog on mount; kept separate
// from the component to avoid breaking Fast Refresh.
let inviteHandler: ((room: DashboardRoom) => void) | null = null

export function setJoinRoomHandler(next: ((room: DashboardRoom) => void) | null) {
	inviteHandler = next
}

export function openJoinRoom(room: DashboardRoom) {
	inviteHandler?.(room)
}
