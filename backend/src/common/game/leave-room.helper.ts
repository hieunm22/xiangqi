import prisma from "prisma"
import { BOT_USER_ID, engineManager } from "common/bot-engine"
import { runEndGameTransaction } from "common/game/end-game.helper"
import { syncPlayersPresence } from "common/game/presence-sync"
import { getAvatarUrl, getUTCTimestamp } from "common/helper"
import { getGameHistoryCollection } from "common/mongodb"
import { emitRoomDeleted, emitRoomUsersUpdated } from "common/socket"

export type LeaveRoomResult = "left" | "room-not-found" | "not-in-room"

/**
 * Removes a user from a room and applies every side effect of leaving
 */
export async function leaveRoomEffect(
	roomId: bigint,
	userIdBigInt: bigint
): Promise<LeaveRoomResult> {
	const roomIdNum = Number(roomId)

	const room = await prisma.room.findUnique({
		where: { id: roomId },
		select: { id: true, pve_mode: true, status: true, bet_amount: true, host_id: true }
	})
	if (!room) {
		return "room-not-found"
	}

	const roomUsers = await prisma.roomUser.findMany({
		where: { room_id: roomId },
		select: {
			user_id: true,
			team: true,
			joined_at: true,
			users: {
				select: {
					id: true,
					display_name: true,
					avatar_seq: true,
					total_amount: true,
					is_bot: true
				}
			}
		},
		orderBy: { joined_at: "asc" }
	})

	const currentRoomUser = roomUsers.find(ru => ru.user_id === userIdBigInt)
	if (!currentRoomUser) {
		return "not-in-room"
	}

	const isHostLeaving = room.host_id === userIdBigInt

	// Spectator (team = null) leaving: just remove and emit the updated list.
	if (!currentRoomUser.team) {
		await prisma.roomUser.deleteMany({
			where: { room_id: roomId, user_id: userIdBigInt }
		})

		const remainingCount = await prisma.roomUser.count({
			where: { room_id: roomId }
		})

		if (remainingCount === 0) {
			await prisma.room.update({
				where: { id: roomId },
				data: { is_active: false }
			})
			emitRoomDeleted(roomIdNum)
		} else {
			const remaining = roomUsers.filter(ru => ru.user_id !== userIdBigInt)
			const formattedUsers = formatRoomUsers(remaining)
			if (isHostLeaving) {
				const { newHostId, deactivated } = await reassignHost(roomId, remaining)
				if (deactivated) {
					emitRoomDeleted(roomIdNum)
				} else {
					emitRoomUsersUpdated(roomIdNum, formattedUsers, newHostId)
				}
			} else {
				emitRoomUsersUpdated(roomIdNum, formattedUsers)
			}
		}

		return "left"
	}

	// Player leaving: end an active game (like a surrender) then remove this player.
	const activeGame = await prisma.game.findFirst({
		where: { room_id: roomId, status: 1 },
		select: { id: true }
	})

	let winnerId: bigint | null = null
	if (activeGame) {
		if (room.pve_mode) {
			winnerId = BOT_USER_ID
		} else {
			// PvP: opponent wins
			const opponent = roomUsers.find(ru => ru.team && ru.team !== currentRoomUser.team)
			if (opponent) {
				winnerId = opponent.user_id
			}
		}

		if (winnerId) {
			const collection = await getGameHistoryCollection()
			const latestRecord = await collection
				.find({ $or: [{ game_id: activeGame.id }, { gameId: activeGame.id }] })
				.sort({ _id: -1 })
				.limit(1)
				.toArray()

			const winnerTeam = currentRoomUser.team === "red" ? "black" : "red"
			if (latestRecord?.length > 0 && latestRecord[0]?.fen) {
				await collection.insertOne({
					game_id: activeGame.id,
					fen: latestRecord[0].fen,
					team: winnerTeam,
					time_stamp: getUTCTimestamp(),
					leave: Number(userIdBigInt),
					winner_id: Number(winnerId),
					end_reason: "leave"
				})
			}

			const ended = await runEndGameTransaction({
				gameId: activeGame.id,
				roomId,
				winnerId,
				isBotGame: room.pve_mode,
				betAmount: room.bet_amount,
				endReason: "leave"
			})

			// Skip game-over side effects when another request already ended the game.
			if (ended) {
				// Game ended because a player left — clear "busy" for the participants.
				await syncPlayersPresence(activeGame.id, false)

				engineManager.releaseEngine(activeGame.id).catch(err => {
					console.error(`[leave-room] failed to release engine for game ${activeGame.id}:`, err)
				})
			}
		}
	}

	// In PvE mode, remove all users and deactivate the room.
	if (room.pve_mode) {
		await prisma.roomUser.deleteMany({
			where: { room_id: roomId }
		})

		await prisma.room.update({
			where: { id: roomId },
			data: { is_active: false }
		})

		emitRoomDeleted(roomIdNum)
	} else {
		// In PvP mode, only remove the leaving player.
		await prisma.roomUser.deleteMany({
			where: { room_id: roomId, user_id: userIdBigInt }
		})

		const remainingCount = await prisma.roomUser.count({
			where: { room_id: roomId }
		})

		// Deactivate the room only if no users remain.
		if (remainingCount === 0) {
			await prisma.room.update({
				where: { id: roomId },
				data: { is_active: false }
			})
			emitRoomDeleted(roomIdNum)
		} else {
			const remaining = roomUsers.filter(ru => ru.user_id !== userIdBigInt)
			const formattedUsers = formatRoomUsers(remaining)
			if (isHostLeaving) {
				const { newHostId, deactivated } = await reassignHost(roomId, remaining)
				if (deactivated) {
					emitRoomDeleted(roomIdNum)
				} else {
					emitRoomUsersUpdated(roomIdNum, formattedUsers, newHostId)
				}
			} else {
				emitRoomUsersUpdated(roomIdNum, formattedUsers)
			}
		}
	}

	return "left"
}

	// Transfer the host role when the host leaves: prefer seated opponent, then earliest spectator.
	// If no real user remains, deactivate the room. `remaining` ordered by joined_at ascending.
async function reassignHost(
	roomId: bigint,
	remaining: { user_id: bigint; team: string | null }[]
): Promise<{ newHostId: number | null; deactivated: boolean }> {
	const candidates = remaining.filter(ru => ru.user_id !== BOT_USER_ID)
	// Prefer the seated opponent (team set); otherwise the earliest-joined spectator.
	const newHost = candidates.find(ru => ru.team != null) ?? candidates[0] ?? null

	if (!newHost) {
		await prisma.room.update({
			where: { id: roomId },
			data: { host_id: null, is_active: false }
		})
		return { newHostId: null, deactivated: true }
	}

	await prisma.room.update({
		where: { id: roomId },
		data: { host_id: newHost.user_id }
	})
	return { newHostId: Number(newHost.user_id), deactivated: false }
}

function formatRoomUsers(roomUsers: any[]) {
	return roomUsers.map(roomUser => ({
		id: Number(roomUser.users.id),
		display_name: roomUser.users.display_name,
		avatar_seq: Number(roomUser.users.avatar_seq),
		avatar_url: getAvatarUrl(roomUser.users.id, roomUser.users.avatar_seq),
		team: roomUser.team,
		total_amount: roomUser.users.total_amount,
		is_bot: roomUser.users.is_bot,
		joined_at: roomUser.joined_at
	}))
}
