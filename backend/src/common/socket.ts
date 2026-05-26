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

		socket.on("disconnect", async (reason) => {
			const disconnectedUserId = socketIdToUserId.get(socket.id)

			if (disconnectedUserId !== undefined) {
				socketIdToUserId.delete(socket.id)

				const socketIds = userIdToSocketIds.get(disconnectedUserId)
				if (socketIds) {
					socketIds.delete(socket.id)
					if (socketIds.size === 0) {
						userIdToSocketIds.delete(disconnectedUserId)

						// Socket disconnected abruptly without calling leave-room API:
						// remove user from room, promote audience if needed, and broadcast updated users.
						try {
							const userRooms = await prisma.roomUser.findMany({
								where: {
									user_id: BigInt(disconnectedUserId)
								},
								select: {
									room_id: true
								}
							})

							for (const userRoom of userRooms) {
								const roomId = Number(userRoom.room_id)
								await leaveAndRebalanceRoom(roomId, disconnectedUserId)
							}
						} catch (error) {
							console.error(`[Socket.io] [${new Date().toISOString()}] Disconnect auto-leave failed for user ${disconnectedUserId}:`, error)
						}
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
 * Emit move piece event to all clients in a room EXCEPT the sender
 */
export function emitMovePiece(roomId: string, moveRecord: any, excludeUserId?: number) {
	const io = getIO()
	const roomChannel = `room-${roomId}`
	
	let excludeSocketIds: string[] = []
	if (excludeUserId !== undefined) {
		excludeSocketIds = Array.from(userIdToSocketIds.get(excludeUserId) ?? [])
	}
	
	console.log(`[Socket.io] [${new Date().toISOString()}] Emitting move piece to ${roomChannel}:`, {
		game_id: moveRecord.game_id,
		team: moveRecord.team,
		fen: moveRecord.fen,
		excludeUserId,
		excludeSocketIds
	})
	
	if (excludeSocketIds.length > 0) {
		io.to(roomChannel).except(excludeSocketIds).emit("piece-moved", moveRecord)
		console.log(`[Socket.io] [${new Date().toISOString()}] Move piece emitted to ${roomChannel} (excluding user ${excludeUserId})`)
	} else {
		io.to(roomChannel).emit("piece-moved", moveRecord)
		console.log(`[Socket.io] [${new Date().toISOString()}] Move piece emitted to ${roomChannel}`)
	}
}

async function leaveAndRebalanceRoom(roomId: number, userId: number) {
	const roomIdBigInt = BigInt(roomId)
	const userIdBigInt = BigInt(userId)

	const txResult = await prisma.$transaction(async tx => {
		const currentRoomUser = await tx.roomUser.findUnique({
			where: {
				room_id_user_id: {
					room_id: roomIdBigInt,
					user_id: userIdBigInt
				}
			},
			select: {
				team: true
			}
		})

		if (!currentRoomUser) {
			return {
				leftRoom: false,
				roomDeleted: false,
				users: [] as any[]
			}
		}

		await tx.roomUser.deleteMany({
			where: {
				room_id: roomIdBigInt,
				user_id: userIdBigInt
			}
		})

		if (currentRoomUser.team) {
			const audienceToPromote = await tx.roomUser.findFirst({
				where: {
					room_id: roomIdBigInt,
					team: null
				},
				orderBy: {
					joined_at: "asc"
				},
				select: {
					room_id: true,
					user_id: true
				}
			})

			if (audienceToPromote) {
				await tx.roomUser.update({
					where: {
						room_id_user_id: {
							room_id: audienceToPromote.room_id,
							user_id: audienceToPromote.user_id
						}
					},
					data: {
						team: currentRoomUser.team
					}
				})
			}
		}

		const remainingUsers = await tx.roomUser.count({
			where: {
				room_id: roomIdBigInt
			}
		})

		if (remainingUsers === 0) {
			await tx.room.delete({
				where: {
					id: roomIdBigInt
				}
			})

			return {
				leftRoom: true,
				roomDeleted: true,
				users: [] as any[]
			}
		}

		const roomUsers = await tx.roomUser.findMany({
			where: {
				room_id: roomIdBigInt
			},
			select: {
				joined_at: true,
				team: true,
				users: {
					select: {
						id: true,
						display_name: true,
						avatar_seq: true
					}
				}
			},
			orderBy: {
				joined_at: "asc"
			}
		})

		const formattedUsers = roomUsers.map(roomUser => ({
			id: Number(roomUser.users.id),
			display_name: roomUser.users.display_name,
			avatar_seq: Number(roomUser.users.avatar_seq),
			avatar_url:
				Number(roomUser.users.avatar_seq) === 0
					? `/images/${Number(roomUser.users.id)}.jpg`
					: `/images/${Number(roomUser.users.id)}_${Number(roomUser.users.avatar_seq)}.jpg`,
			team: roomUser.team,
			joined_at: roomUser.joined_at
		}))

		return {
			leftRoom: true,
			roomDeleted: false,
			users: formattedUsers
		}
	})

	if (txResult.leftRoom && !txResult.roomDeleted) {
		emitRoomUsersUpdated(roomId, txResult.users)
	}

	if (txResult.leftRoom && txResult.roomDeleted) {
		emitRoomDeleted(roomId)
	}
}

/**
 * Emit game surrender event to all clients in a room
 */
export function emitGameSurrender(roomId: string, data: any) {
	const io = getIO()
	io.to(`room-${roomId}`).emit("game-surrendered", data)
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
