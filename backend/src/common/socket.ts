import { Server as SocketIOServer, Socket } from "socket.io"
import { Server as HTTPServer } from "http"
import prisma from "prisma"

let io: SocketIOServer | null = null

// Map userId to all connected socketIds (supports multiple tabs/devices)
const userIdToSocketIds = new Map<number, Set<string>>()
const socketIdToUserId = new Map<string, number>()

/**
 * Initialize Socket.io server
 */
export function initializeSocket(httpServer: HTTPServer) {
	const corsOriginStr = process.env.CORS_ORIGINS ?? "http://localhost:3004"
	const corsOrigins = corsOriginStr.split(",").map(o => o.trim()).filter(Boolean)
	
	// In development, also allow common dev ports
	if (process.env.NODE_ENV !== "production") {
		const devPorts = [
			"http://localhost:3004",
			"http://localhost:5001",
			"http://localhost:8000",
			"https://xaq.hieunm.io.vn",
			"https://xaa.hieunm.io.vn"
		]
		devPorts.forEach(port => {
			if (!corsOrigins.includes(port)) {
				corsOrigins.push(port)
			}
		})
	}

	console.log(`[Socket.io] Initializing with CORS origins:`, corsOrigins)
	
	io = new SocketIOServer(httpServer, {
		cors: {
			origin: corsOrigins,
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
			console.log(`[Socket.io] [${new Date().toISOString()}] User ${userId} (socket ${socket.id}) registered`)
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

						// Auto-leave on socket disconnect disabled for now — was kicking users
						// out of rooms on transient drops (refresh, brief network loss). Users
						// must explicitly call /api/room/leave to exit a room.
						// TODO
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
export function emitRoomUsersUpdated(roomId: string | number, users: any[]) {
	if (!io) {
		console.warn(`[Socket.io] Cannot emit room-users-updated: Socket.io server not initialized`)
		return
	}

	const roomChannel = `room-${roomId}`
	io.to(roomChannel).emit("room-users-updated", {
		roomId,
		users
	})
	io.emit("dashboard-room-users-updated", {
		roomId,
		users
	})
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
