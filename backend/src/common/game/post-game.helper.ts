import prisma from "prisma"
import { getAvatarUrl } from "common/helper"
import { emitRoomUsersUpdated } from "common/socket"
import {
	PostGameLockState,
	PostGameParticipant,
	RoomUserSnapshot,
	StartPostGameLockParams,
	Team
} from "types/game.type"

export const POST_GAME_BACK_TIMEOUT_MS = 15_000

const roomPostGameLocks = new Map<number, PostGameLockState>()

const isTeam = (team: string | null): team is Team => {
	return team === "red" || team === "black"
}

function mapRoomUsersForRealtime(roomUsers: RoomUserSnapshot[]) {
	return roomUsers.map(roomUser => ({
		avatar_url: getAvatarUrl(roomUser.users.id, roomUser.users.avatar_seq),
		display_name: roomUser.users.display_name,
		id: Number(roomUser.users.id),
		is_bot: roomUser.users.is_bot,
		joined_at: roomUser.joined_at,
		team: roomUser.team,
		total_amount: roomUser.users.total_amount
	}))
}

async function loadRoomUsersSnapshot(roomId: bigint): Promise<RoomUserSnapshot[]> {
	return prisma.roomUser.findMany({
		where: { room_id: roomId },
		orderBy: { joined_at: "asc" },
		select: {
			joined_at: true,
			team: true,
			users: {
				select: {
					avatar_seq: true,
					display_name: true,
					id: true,
					is_bot: true,
					total_amount: true
				}
			}
		}
	})
}

function startPostGameLock(params: StartPostGameLockParams) {
	const { roomId, gameId, onTimeout, participants } = params
	clearPostGameLock(roomId)

	const participantMap = new Map<number, PostGameParticipant>()
	for (const participant of participants) {
		participantMap.set(participant.userId, {
			ready: false,
			team: participant.team,
			userId: participant.userId
		})
	}

	const state: PostGameLockState = {
		deadlineAt: Date.now() + POST_GAME_BACK_TIMEOUT_MS,
		gameId,
		participants: participantMap,
		timer: null
	}

	const timer = setTimeout(() => {
		const latest = roomPostGameLocks.get(roomId)
		if (!latest || latest.gameId !== gameId) {
			return
		}

		const notReadyUserIds = Array.from(latest.participants.values())
			.filter(participant => !participant.ready)
			.map(participant => participant.userId)

		clearPostGameLock(roomId)
		void onTimeout({ roomId, gameId, notReadyUserIds })
	}, POST_GAME_BACK_TIMEOUT_MS)

	timer.unref?.()
	state.timer = timer
	roomPostGameLocks.set(roomId, state)
}

export function clearPostGameLock(roomId: number) {
	const current = roomPostGameLocks.get(roomId)
	if (!current) {
		return
	}

	if (current.timer) {
		clearTimeout(current.timer)
	}

	roomPostGameLocks.delete(roomId)
}

export function decorateRoomUsersWithBackReady<T extends { id: number }>(
	roomId: number,
	users: T[]
): Array<T & { back_ready: boolean | null }> {
	const state = roomPostGameLocks.get(roomId)

	return users.map(user => {
		const participant = state?.participants.get(user.id)
		return {
			...user,
			back_ready: participant ? participant.ready : null
		}
	})
}

export async function emitRoomUsersSnapshot(roomId: bigint) {
	const users = await loadRoomUsersSnapshot(roomId)
	emitRoomUsersUpdated(Number(roomId), mapRoomUsersForRealtime(users))
}

export function isPostGameStartBlocked(roomId: number): boolean {
	const state = roomPostGameLocks.get(roomId)
	if (!state) {
		return false
	}

	for (const participant of state.participants.values()) {
		if (!participant.ready) {
			return true
		}
	}

	return false
}

export function markPostGameReady(params: {
	roomId: number
	gameId: string
	userId: number
}): boolean {
	const { roomId, gameId, userId } = params
	const state = roomPostGameLocks.get(roomId)
	if (!state || state.gameId !== gameId) {
		return false
	}

	const participant = state.participants.get(userId)
	if (!participant) {
		return false
	}

	participant.ready = true
	return true
}

export async function activatePostGameLock(roomId: bigint, gameId: string) {
	const roomUsers = await loadRoomUsersSnapshot(roomId)
	const participants = roomUsers
		.filter((roomUser): roomUser is RoomUserSnapshot & { team: Team } => {
			return !roomUser.users.is_bot && isTeam(roomUser.team)
		})
		.map(roomUser => ({
			team: roomUser.team,
			userId: Number(roomUser.users.id)
		}))

	if (participants.length < 2) {
		clearPostGameLock(Number(roomId))
		return
	}

	startPostGameLock({
		roomId: Number(roomId),
		gameId,
		participants,
		onTimeout: async () => {
			await emitRoomUsersSnapshot(roomId)
		}
	})

	emitRoomUsersUpdated(Number(roomId), mapRoomUsersForRealtime(roomUsers))
}
