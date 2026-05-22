import { Server as SocketIOServer, Socket } from "socket.io"
import { Server as HTTPServer } from "http"

let io: SocketIOServer | null = null

// Map userId to socketId for tracking connected users
const userIdToSocketId = new Map<number, string>()

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
				userIdToSocketId.set(userId, socket.id)
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

		socket.on("disconnect", (reason) => {
			// Clean up userId mapping
			for (const [userId, socketId] of userIdToSocketId.entries()) {
				if (socketId === socket.id) {
					userIdToSocketId.delete(userId)
					break
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
	
	let excludeSocketId: string | undefined = undefined
	if (excludeUserId !== undefined) {
		excludeSocketId = userIdToSocketId.get(excludeUserId)
	}
	
	console.log(`[Socket.io] [${new Date().toISOString()}] Emitting move piece to ${roomChannel}:`, {
		game_id: moveRecord.game_id,
		team: moveRecord.team,
		fen: moveRecord.fen,
		excludeUserId,
		excludeSocketId
	})
	
	if (excludeSocketId) {
		io.to(roomChannel).except(excludeSocketId).emit("piece-moved", moveRecord)
		console.log(`[Socket.io] [${new Date().toISOString()}] Move piece emitted to ${roomChannel} (excluding user ${excludeUserId})`)
	} else {
		io.to(roomChannel).emit("piece-moved", moveRecord)
		console.log(`[Socket.io] [${new Date().toISOString()}] Move piece emitted to ${roomChannel}`)
	}
}

/**
 * Emit game surrender event to all clients in a room
 */
export function emitGameSurrender(roomId: string, data: any) {
	const io = getIO()
	io.to(`room-${roomId}`).emit("game-surrendered", data)
}
