import { Server as SocketIOServer, Socket } from "socket.io"
import { Server as HTTPServer } from "http"
import prisma from "prisma"
import { getAllowedOrigins, isOriginAllowed } from "common/cors"
import { decorateRoomUsersWithBackReady } from "common/game/post-game.helper"
import {
	PRESENCE_DISCONNECT_GRACE_MS,
	PresenceStatus,
	markInactive,
	recordHeartbeat
} from "common/presence"

let io: SocketIOServer | null = null

// Map userId to all connected socketIds (supports multiple tabs/devices)
const userIdToSocketIds = new Map<number, Set<string>>()
const socketIdToUserId = new Map<string, number>()

// Pending "force inactive" timers, keyed by userId, started when a user's last
// socket disconnects and cancelled if they reconnect within the grace window.
const presenceInactiveTimers = new Map<number, NodeJS.Timeout>()

// A user is active again (reconnected / heartbeating): cancel any pending
// disconnect-driven inactive transition.
function cancelInactiveTimer(userId: number) {
	const timer = presenceInactiveTimers.get(userId)
	if (timer) {
		clearTimeout(timer)
		presenceInactiveTimers.delete(userId)
	}
}

/**
 * number of sockets the user currently has connected. Used to
 * avoid marking a user offline on logout while another device is still online.
 */
export function getConnectedDeviceCount(userId: number): number {
	return userIdToSocketIds.get(userId)?.size ?? 0
}

/**
 * Initialize Socket.io server
 */
export function initializeSocket(httpServer: HTTPServer) {
	// Same origin rules as the Express API (see common/cors): explicit
	// CORS_ORIGINS whitelist, plus localhost/private-LAN origins in development
	const allowedOrigins = getAllowedOrigins()
	console.log(`[Socket.io] Initializing with CORS origins:`, allowedOrigins)

	io = new SocketIOServer(httpServer, {
		cors: {
			origin: (requestOrigin, callback) => {
				if (isOriginAllowed(requestOrigin, allowedOrigins)) {
					callback(null, true)
				} else {
					callback(new Error(`CORS: origin '${requestOrigin}' is not allowed`))
				}
			},
			credentials: true,
		},
		transports: ["websocket", "polling"],
		connectTimeout: 10000,
	})

	io.on("connection", (socket: Socket) => {
		console.log(`[Socket.io] [${new Date().toISOString()}] Client connected: ${socket.id}`, {
			transport: socket.conn.transport.name,
			remoteAddress: socket.handshake.address,
			origin: socket.handshake.headers.origin
		})

		socket.on("join-room", (data: any) => {
			const roomId = typeof data === "string" || typeof data === "number" ? data : data?.roomId
			const userId = typeof data === "object" ? data?.userId : undefined
			const roomChannel = `room-${roomId}`
			
			socket.join(roomChannel)
			
			if (userId) {
				let socketIds = userIdToSocketIds.get(userId)
				if (!socketIds) {
					socketIds = new Set<string>()
					userIdToSocketIds.set(userId, socketIds)
				}
				socketIds.add(socket.id)
				socketIdToUserId.set(socket.id, userId)
				cancelInactiveTimer(userId)
				console.log(`[Socket.io] [${new Date().toISOString()}] User ${userId} (socket ${socket.id}) joined room: ${roomChannel}`)
			} else {
				console.log(`[Socket.io] [${new Date().toISOString()}] Client ${socket.id} joined room: ${roomChannel}`)
			}
		})

		socket.on("leave-room", (roomId: string | number) => {
			const roomChannel = `room-${roomId}`
			socket.leave(roomChannel)
			console.log(`[Socket.io] [${new Date().toISOString()}] Client ${socket.id} left room: ${roomChannel}`)
		})

		// Register the authenticated user so private messages can be delivered to
		// every device/tab of that user, regardless of which page they are on.
		socket.on("register-user", (data: any) => {
			const userId = typeof data === "object" ? Number(data?.userId) : Number(data)
			if (!Number.isInteger(userId) || userId <= 0) return

			socket.join(`user-${userId}`)

			let socketIds = userIdToSocketIds.get(userId)
			if (!socketIds) {
				socketIds = new Set<string>()
				userIdToSocketIds.set(userId, socketIds)
			}
			socketIds.add(socket.id)
			socketIdToUserId.set(socket.id, userId)
			cancelInactiveTimer(userId)
			console.log(`[Socket.io] [${new Date().toISOString()}] User ${userId} (socket ${socket.id}) registered`)
		})

			// Presence heartbeat: each ping refreshes the user's online timestamp.
			// The first ping after going offline is broadcast to update other clients.
		socket.on("presence-ping", async (data: any) => {
			const userId = typeof data === "object" ? Number(data?.userId) : Number(data)
			if (!Number.isInteger(userId) || userId <= 0) return

			// A heartbeat means the user is active again — cancel any pending
			// disconnect-driven inactive transition.
			cancelInactiveTimer(userId)

			try {
				const becameOnline = await recordHeartbeat(userId)
				if (becameOnline) {
					emitPresenceChanged(userId, "online")
				}
			} catch (error) {
				console.error(`[Socket.io] [${new Date().toISOString()}] presence-ping error for user ${userId}:`, error)
			}
		})

		socket.on("disconnect", async (reason) => {
			const disconnectedUserId = socketIdToUserId.get(socket.id)

			if (disconnectedUserId !== undefined) {
				socketIdToUserId.delete(socket.id)

				const socketIds = userIdToSocketIds.get(disconnectedUserId)
				if (socketIds) {
					socketIds.delete(socket.id)
					if (socketIds.size === 0) {
						userIdToSocketIds.delete(disconnectedUserId)

						// Auto-leave on disconnect disabled (was kicking users on transient drops).
						// Users must explicitly call /api/room/leave to exit. TODO

						// Last socket closed: after a short grace period, force the user "inactive"
						// so they stop showing as online before the heartbeat ages out.
						const userId = disconnectedUserId
						cancelInactiveTimer(userId)
						const timer = setTimeout(async () => {
							presenceInactiveTimers.delete(userId)
							if (userIdToSocketIds.has(userId)) return	// reconnected during grace

							try {
								const becameInactive = await markInactive(userId)
								if (becameInactive) {
									emitPresenceChanged(userId, "inactive")
								}
							} catch (error) {
								console.error(`[Socket.io] [${new Date().toISOString()}] markInactive error for user ${userId}:`, error)
							}
						}, PRESENCE_DISCONNECT_GRACE_MS)
						timer.unref?.()
						presenceInactiveTimers.set(userId, timer)
					}
				}
			}

			console.log(`[Socket.io] [${new Date().toISOString()}] Client disconnected: ${socket.id}, reason: ${reason}`)
		})

		// Listen for player move piece events from client
		socket.on("player-move", (moveData: any) => {
			console.log(`[Socket.io] [${new Date().toISOString()}] Received player move from ${socket.id}:`, {
				gameId: moveData.gameId,
				newFen: moveData.newFen?.substring(0, 30) + "...",
				team: moveData.team,
				capturePiece: moveData.capturePiece,
				fullData: moveData
			})
		})

		socket.on("draw-request", (data: any) => {
			console.log(`[Socket.io] [${new Date().toISOString()}] Received draw request from ${socket.id}:`, data)
			if (data && data.roomId && data.gameId && typeof data.requestUserId === "number") {
				emitDrawRequest(data.roomId, data.gameId, data.requestUserId)
			}
		})

		socket.on("draw-response", (data: any) => {
			console.log(`[Socket.io] [${new Date().toISOString()}] Received draw response from ${socket.id}:`, data)
			if (
				data
				&& data.roomId
				&& data.gameId
				&& typeof data.accepted === "boolean"
				&& typeof data.requestUserId === "number"
			) {
				emitDrawResponse(
					data.roomId,
					data.gameId,
					data.accepted,
					data.requestUserId,
					data.responseUserId
				)
			}
		})

		socket.on("surrender", (data: any) => {
			console.log(`[Socket.io] [${new Date().toISOString()}] Received surrender from ${socket.id}:`, data)
			if (data && data.roomId && data.gameId && typeof data.surrenderingUserId === "number") {
				emitSurrender(data.roomId, data.gameId, data.surrenderingUserId)
			}
		})

		socket.on("room-invite", async (data: any) => {
			if (!data?.inviteeId || !data?.roomId || !data?.inviterId) return

			const inviter = await prisma.user.findUnique({
				where: { id: BigInt(data.inviterId) },
				select: { display_name: true }
			})
			if (!inviter) return

			// never invite a user who cannot afford the room's bet
			const room = await prisma.room.findUnique({
				where: { id: BigInt(data.roomId) },
				select: { bet_amount: true }
			})
			if (room && room.bet_amount > 0) {
				const invitee = await prisma.user.findUnique({
					where: { id: BigInt(data.inviteeId) },
					select: { total_amount: true }
				})
				// Integer-safe form of `bet_amount > total_amount * 0.8`.
				if (!invitee || room.bet_amount * 10 > invitee.total_amount * 8) return
			}

			emitRoomInvite(Number(data.inviteeId), {
				roomId: Number(data.roomId),
				inviterDisplayName: inviter.display_name
			})
		})

		socket.on("error", (error) => {
			console.error(`[Socket.io] [${new Date().toISOString()}] Client error ${socket.id}:`, error)
		})
	})

	// Server level error handlers
	io.engine.on("connection_error", (err) => {
		console.error(`[Socket.io] Connection error:`, {
			message: err.message,
			type: err.type,
			code: (err as any).code,
		})
	})

	io.on("connect_error", (err) => {
		console.error(`[Socket.io] Server connect error:`, err)
	})

	return io
}

/**
 * Get Socket.io instance
 */
export function getIO(): SocketIOServer {
	if (!io) {
		throw new Error("Socket.io server not initialized")
	}
	return io
}

/**
 * Emit move piece event to all clients in room
 */
export function emitMovePiece(roomId: string | number, moveRecord: any, userId?: number) {
	const io = getIO()
	const roomChannel = `room-${roomId}`

	// Add userId to payload so client can identify sender
	const payload = { ...moveRecord, userId }

	console.log(`[Socket.io] [${new Date().toISOString()}] Emitting move piece to ${roomChannel}:`, {
		game_id: moveRecord.game_id,
		team: moveRecord.team,
		fen: moveRecord.fen,
		userId
	})

	io.to(roomChannel).emit("piece-moved", payload)
	console.log(`[Socket.io] [${new Date().toISOString()}] Move piece emitted to all clients in ${roomChannel}`)
}

/**
 * Emit a new room chat message to all clients in a room.
 * The payload carries `userId` so the sender's client can ignore its own message.
 */
export function emitRoomMessage(roomId: string | number, message: any, senderId: number) {
	if (!io) {
		console.warn(`[Socket.io] Cannot emit room-message-sent: Socket.io server not initialized`)
		return
	}

	const roomChannel = `room-${roomId}`
	io.to(roomChannel).emit("room-message-sent", { ...message, userId: senderId })
	console.log(`[Socket.io] [${new Date().toISOString()}] Room message emitted to ${roomChannel}`)
}

/**
 * Emit a new private message to the receiver's personal channel so their
 * conversation list / unread badge can update in real time.
 */
export function emitPrivateMessage(receiverId: number, message: any) {
	if (!io) {
		console.warn(`[Socket.io] Cannot emit private-message-sent: Socket.io server not initialized`)
		return
	}

	const userChannel = `user-${receiverId}`
	io.to(userChannel).emit("private-message-sent", message)
	console.log(`[Socket.io] [${new Date().toISOString()}] Private message emitted to ${userChannel}`)
}

/**
 * Broadcast a new announcement to all clients for real-time badge/screen updates.
 * Payload includes `userId` so the sender's client can ignore the event.
 */
export function emitAnnouncement(message: any, senderId: number) {
	if (!io) {
		console.warn(`[Socket.io] Cannot emit announcement-sent: Socket.io server not initialized`)
		return
	}

	io.emit("announcement-sent", { ...message, userId: senderId })
	console.log(`[Socket.io] [${new Date().toISOString()}] Announcement emitted to all clients`)
}

/**
 * Emit game surrender event to all clients in a room
 */
export function emitGameSurrender(roomId: string, data: any) {
	const io = getIO()
	io.to(`room-${roomId}`).emit("game-surrendered", data)
}

/**
 * Emit game started event to all clients in a room (host, opponent, spectators)
 */
export function emitGameStarted(roomId: string | number, data: any) {
	if (!io) {
		console.warn(`[Socket.io] Cannot emit game-started: Socket.io server not initialized`)
		return
	}

	const roomChannel = `room-${roomId}`
	io.to(roomChannel).emit("game-started", { roomId, ...data })
	console.log(`[Socket.io] [${new Date().toISOString()}] Game started emitted to ${roomChannel}`)
}

/**
 * Emit game-ended event to all clients in a room.
 */
export function emitGameEnded(roomId: string | number, data: any) {
	if (!io) {
		console.warn(`[Socket.io] Cannot emit game-ended: Socket.io server not initialized`)
		return
	}

	const roomChannel = `room-${roomId}`
	io.to(roomChannel).emit("game-ended", { roomId, ...data })
	console.log(`[Socket.io] [${new Date().toISOString()}] Game ended emitted to ${roomChannel}`)
}

/**
 * Emit a perpetual-check warning to all clients in a room.
 */
export function emitPerpetualCheckWarning(roomId: string | number, data: any) {
	if (!io) {
		console.warn(`[Socket.io] Cannot emit perpetual-check-warning: Socket.io server not initialized`)
		return
	}

	const roomChannel = `room-${roomId}`
	io.to(roomChannel).emit("perpetual-check-warning", { roomId, ...data })
}

/**
 * Emit draw request to all clients in a room
 */
export function emitDrawRequest(roomId: string | number, gameId: string, requestUserId: number) {
	const io = getIO()
	const roomChannel = `room-${roomId}`
	io.to(roomChannel).emit("draw-request", { roomId, gameId, requestUserId })
	console.log(`[Socket.io] [${new Date().toISOString()}] Draw request emitted to ${roomChannel}`)
}

/**
 * Emit draw response to all clients in a room
 */
export function emitDrawResponse(
	roomId: string | number,
	gameId: string,
	accepted: boolean,
	requestUserId: number,
	responseUserId?: number
) {
	const io = getIO()
	const roomChannel = `room-${roomId}`
	io.to(roomChannel).emit("draw-response", {
		roomId,
		gameId,
		accepted,
		requestUserId,
		responseUserId
	})
	console.log(`[Socket.io] [${new Date().toISOString()}] Draw response emitted to ${roomChannel}`)
}

/**
 * Emit surrender event to all clients in a room
 */
export function emitSurrender(roomId: string | number, gameId: string, surrenderingUserId: number) {
	const io = getIO()
	const roomChannel = `room-${roomId}`
	io.to(roomChannel).emit("surrender", {
		roomId,
		gameId,
		surrenderingUserId
	})
	console.log(`[Socket.io] [${new Date().toISOString()}] Surrender event emitted to ${roomChannel}`)
}

// ------------------------------------------------------------------------

/**
 * Emit joined users update to all clients in a room
 */
export function emitRoomUsersUpdated(roomId: string | number, users: any[], hostId?: number | null) {
	if (!io) {
		console.warn(`[Socket.io] Cannot emit room-users-updated: Socket.io server not initialized`)
		return
	}

	const roomChannel = `room-${roomId}`
	const roomIdNumber = Number(roomId)
	const usersWithBackReady = Number.isInteger(roomIdNumber)
		? decorateRoomUsersWithBackReady(roomIdNumber, users)
		: users
	// Only carry `hostId` when the caller knows it changed; clients keep their
	// current host when the field is absent.
	const payload = hostId === undefined
		? { roomId, users: usersWithBackReady }
		: { roomId, users: usersWithBackReady, hostId }
	io.to(roomChannel).emit("room-users-updated", payload)
	io.emit("dashboard-room-users-updated", payload)
	console.log(`[Socket.io] [${new Date().toISOString()}] Room users updated emitted to ${roomChannel}`)
}

/**
 * Emit a kick event so the kicked user's client can leave the room.
 * Broadcast on the room channel; the client filters by userId.
 */
export function emitUserKicked(roomId: string | number, userId: number) {
	if (!io) {
		console.warn(`[Socket.io] Cannot emit user-kicked: Socket.io server not initialized`)
		return
	}

	const roomChannel = `room-${roomId}`
	io.to(roomChannel).emit("user-kicked", {
		roomId,
		userId
	})
	console.log(`[Socket.io] [${new Date().toISOString()}] User ${userId} kicked emitted to ${roomChannel}`)
}

/**
 * Emit room created event to all connected clients
 */
export function emitRoomCreated(room: any) {
	if (!io) {
		console.warn(`[Socket.io] Cannot emit room-created: Socket.io server not initialized`)
		return
	}

	io.emit("room-created", {
		room
	})
	console.log(`[Socket.io] [${new Date().toISOString()}] Room created emitted: room ${room?.id}`)
}

/**
 * Emit room deleted event to all connected clients
 */
export function emitRoomDeleted(roomId: string | number) {
	if (!io) {
		console.warn(`[Socket.io] Cannot emit room-deleted: Socket.io server not initialized`)
		return
	}

	io.emit("room-deleted", {
		roomId
	})
	console.log(`[Socket.io] [${new Date().toISOString()}] Room deleted emitted: room ${roomId}`)
}

/**
 * Emit a room invitation to a specific user's personal channel
 */
export function emitRoomInvite(inviteeId: number, payload: { roomId: number; inviterDisplayName: string }) {
	if (!io) {
		console.warn(`[Socket.io] Cannot emit room-invite: Socket.io server not initialized`)
		return
	}

	io.to(`user-${inviteeId}`).emit("room-invite", payload)
	console.log(`[Socket.io] [${new Date().toISOString()}] Room invite emitted to user-${inviteeId}`)
}

/**
 * Broadcast a user's presence transition (online / inactive / offline) to every
 * connected client so presence indicators can update in real time.
 */
export function emitPresenceChanged(userId: number, status: PresenceStatus) {
	if (!io) {
		console.warn(`[Socket.io] Cannot emit presence-changed: Socket.io server not initialized`)
		return
	}

	io.emit("presence-changed", { userId, status })
	console.log(`[Socket.io] [${new Date().toISOString()}] Presence changed emitted: user ${userId} status=${status}`)
}
