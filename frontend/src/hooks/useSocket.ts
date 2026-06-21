import {
	useCallback,
	useEffect,
	useState,
	useRef
} from "react"
import { io, Socket } from "socket.io-client"

function resolveSocketBaseUrl() {
	const backendBase = import.meta.env.VITE_BACKEND_BASE_URL?.trim()
	if (backendBase) {
		return backendBase
	}

	// In production builds, always prefer current origin over localhost fallback.
	if (typeof window !== "undefined" && window.location?.origin) {
		return window.location.origin
	}

	return "http://localhost:8000"
}

const API_BASE_URL = resolveSocketBaseUrl()

export function useSocket() {
	const socketRef = useRef<Socket | null>(null)
	const [isConnected, setIsConnected] = useState(false)
	
	useEffect(() => {
		// Initialize socket connection
		const socket = io(API_BASE_URL, {
			reconnection: true,
			reconnectionDelay: 1000,
			reconnectionDelayMax: 5000,
			reconnectionAttempts: 10,
			transports: ["websocket"],
			path: "/socket.io",
		})

		socket.on("connect", () => {
			const transport = socket.io.engine.transport?.name || "unknown"
			console.log(`[Socket.io] [${new Date().toISOString()}] Connected: ${socket.id} Transport: ${transport}`)
			if (transport === "websocket") {
				console.log(`[Socket.io] [${new Date().toISOString()}] WebSocket connected`)
			}
			setIsConnected(true)
		})

		socket.io.engine.on("upgrade", (transport) => {
			console.log(`[Socket.io] [${new Date().toISOString()}] Transport upgraded to: ${transport.name}`)
			if (transport.name === "websocket") {
				console.log(`[Socket.io] [${new Date().toISOString()}] WebSocket connected`)
			}
		})

		socket.on("disconnect", (reason) => {
			console.log(`[Socket.io] [${new Date().toISOString()}] Disconnected, reason: ${reason}`)
			setIsConnected(false)
		})

		socket.on("connect_error", (error) => {
			console.error(`[Socket.io] [${new Date().toISOString()}] Connection error: ${error.message}`)
		})

		socket.on("error", (error) => {
			console.error(`[Socket.io] [${new Date().toISOString()}] Error: ${error.message}`)
		})

		socketRef.current = socket

		return () => {
			socket.disconnect()
		}
	}, [])

	const onMovePiece = useCallback((callback: (data: any) => void) => {
		if (socketRef.current) {
			// console.log("[Socket.io] Registering piece-moved listener")
			socketRef.current.on("piece-moved", callback)
		} else {
			console.warn("[Socket.io] Socket not initialized for piece-moved listener")
		}
	}, [])

	const offMovePiece = useCallback((callback: (data: any) => void) => {
		if (socketRef.current) {
			// console.log("[Socket.io] Unregistering piece-moved listener")
			socketRef.current.off("piece-moved", callback)
		}
	}, [])

	const joinRoom = useCallback((roomId: string | number, userId?: number) => {
		if (socketRef.current) {
			const payload = userId ? { roomId: roomId.toString(), userId } : roomId
			// console.log("[Socket.io] Emitting join-room:", payload)
			socketRef.current.emit("join-room", payload)
		} else {
			console.warn("[Socket.io] Socket not initialized for join-room")
		}
	}, [])

	const leaveRoom = useCallback((roomId: string | number) => {
		if (socketRef.current) {
			// console.log("[Socket.io] Emitting leave-room:", roomId)
			socketRef.current.emit("leave-room", roomId)
		}
	}, [])

	const emitPlayerMove = useCallback((moveData: any) => {
		if (socketRef.current) {
			// console.log("[Socket.io] Emitting player-move event:", moveData)
			socketRef.current.emit("player-move", moveData)
		} else {
			console.warn("[Socket.io] Socket not initialized for player-move emit")
		}
	}, [])

	// ------------------------------------------------------------------------

	const emitDrawRequest = useCallback((roomId: string | number, gameId: string, requestUserId: number) => {
		if (socketRef.current) {
			socketRef.current.emit("draw-request", { roomId, gameId, requestUserId })
		} else {
			console.warn("[Socket.io] Socket not initialized for draw-request emit")
		}
	}, [])

	const emitDrawResponse = useCallback((
		roomId: string | number,
		gameId: string,
		accepted: boolean,
		requestUserId: number,
		responseUserId?: number
	) => {
		if (socketRef.current) {
			socketRef.current.emit("draw-response", {
				roomId,
				gameId,
				accepted,
				requestUserId,
				responseUserId
			})
		} else {
			console.warn("[Socket.io] Socket not initialized for draw-response emit")
		}
	}, [])

	const onDrawRequest = useCallback((callback: (data: any) => void) => {
		if (socketRef.current) {
			socketRef.current.on("draw-request", callback)
		} else {
			console.warn("[Socket.io] Socket not initialized for draw-request listener")
		}
	}, [])

	const offDrawRequest = useCallback((callback: (data: any) => void) => {
		if (socketRef.current) {
			socketRef.current.off("draw-request", callback)
		}
	}, [])

	const onDrawResponse = useCallback((callback: (data: any) => void) => {
		if (socketRef.current) {
			socketRef.current.on("draw-response", callback)
		} else {
			console.warn("[Socket.io] Socket not initialized for draw-response listener")
		}
	}, [])

	const offDrawResponse = useCallback((callback: (data: any) => void) => {
		if (socketRef.current) {
			socketRef.current.off("draw-response", callback)
		}
	}, [])

	const emitSurrender = useCallback((roomId: string | number, gameId: string, surrenderingUserId: number) => {
		if (socketRef.current) {
			socketRef.current.emit("surrender", { roomId, gameId, surrenderingUserId })
		} else {
			console.warn("[Socket.io] Socket not initialized for surrender emit")
		}
	}, [])

	const onSurrender = useCallback((callback: (data: any) => void) => {
		if (socketRef.current) {
			socketRef.current.on("surrender", callback)
		} else {
			console.warn("[Socket.io] Socket not initialized for surrender listener")
		}
	}, [])

	const offSurrender = useCallback((callback: (data: any) => void) => {
		if (socketRef.current) {
			socketRef.current.off("surrender", callback)
		}
	}, [])

	const onRoomUsersUpdated = useCallback((callback: (data: any) => void) => {
		if (socketRef.current) {
			socketRef.current.on("room-users-updated", callback)
		} else {
			console.warn("[Socket.io] Socket not initialized for room-users-updated listener")
		}
	}, [])

	const offRoomUsersUpdated = useCallback((callback: (data: any) => void) => {
		if (socketRef.current) {
			socketRef.current.off("room-users-updated", callback)
		}
	}, [])

	const onUserKicked = useCallback((callback: (data: any) => void) => {
		if (socketRef.current) {
			socketRef.current.on("user-kicked", callback)
		} else {
			console.warn("[Socket.io] Socket not initialized for user-kicked listener")
		}
	}, [])

	const offUserKicked = useCallback((callback: (data: any) => void) => {
		if (socketRef.current) {
			socketRef.current.off("user-kicked", callback)
		}
	}, [])

	const onRoomCreated = useCallback((callback: (data: any) => void) => {
		if (socketRef.current) {
			socketRef.current.on("room-created", callback)
		} else {
			console.warn("[Socket.io] Socket not initialized for room-created listener")
		}
	}, [])

	const offRoomCreated = useCallback((callback: (data: any) => void) => {
		if (socketRef.current) {
			socketRef.current.off("room-created", callback)
		}
	}, [])

	const onRoomDeleted = useCallback((callback: (data: any) => void) => {
		if (socketRef.current) {
			socketRef.current.on("room-deleted", callback)
		} else {
			console.warn("[Socket.io] Socket not initialized for room-deleted listener")
		}
	}, [])

	const offRoomDeleted = useCallback((callback: (data: any) => void) => {
		if (socketRef.current) {
			socketRef.current.off("room-deleted", callback)
		}
	}, [])

	const onGameStarted = useCallback((callback: (data: any) => void) => {
		if (socketRef.current) {
			socketRef.current.on("game-started", callback)
		} else {
			console.warn("[Socket.io] Socket not initialized for game-started listener")
		}
	}, [])

	const offGameStarted = useCallback((callback: (data: any) => void) => {
		if (socketRef.current) {
			socketRef.current.off("game-started", callback)
		}
	}, [])

	const onRoomMessageSent = useCallback((callback: (data: any) => void) => {
		if (socketRef.current) {
			socketRef.current.on("room-message-sent", callback)
		} else {
			console.warn("[Socket.io] Socket not initialized for room-message-sent listener")
		}
	}, [])

	const offRoomMessageSent = useCallback((callback: (data: any) => void) => {
		if (socketRef.current) {
			socketRef.current.off("room-message-sent", callback)
		}
	}, [])

	const registerUser = useCallback((userId: number) => {
		if (socketRef.current) {
			socketRef.current.emit("register-user", { userId })
		} else {
			console.warn("[Socket.io] Socket not initialized for register-user")
		}
	}, [])

	const onPrivateMessageSent = useCallback((callback: (data: any) => void) => {
		if (socketRef.current) {
			socketRef.current.on("private-message-sent", callback)
		} else {
			console.warn("[Socket.io] Socket not initialized for private-message-sent listener")
		}
	}, [])

	const offPrivateMessageSent = useCallback((callback: (data: any) => void) => {
		if (socketRef.current) {
			socketRef.current.off("private-message-sent", callback)
		}
	}, [])

	const onAnnouncementSent = useCallback((callback: (data: any) => void) => {
		if (socketRef.current) {
			socketRef.current.on("announcement-sent", callback)
		} else {
			console.warn("[Socket.io] Socket not initialized for announcement-sent listener")
		}
	}, [])

	const offAnnouncementSent = useCallback((callback: (data: any) => void) => {
		if (socketRef.current) {
			socketRef.current.off("announcement-sent", callback)
		}
	}, [])

	const onDashboardRoomUsersUpdated = useCallback((callback: (data: any) => void) => {
		if (socketRef.current) {
			socketRef.current.on("dashboard-room-users-updated", callback)
		} else {
			console.warn("[Socket.io] Socket not initialized for dashboard-room-users-updated listener")
		}
	}, [])

	const offDashboardRoomUsersUpdated = useCallback((callback: (data: any) => void) => {
		if (socketRef.current) {
			socketRef.current.off("dashboard-room-users-updated", callback)
		}
	}, [])

	return {
		isConnected,

		emitDrawRequest,
		emitDrawResponse,
		emitPlayerMove,
		emitSurrender,
		joinRoom,
		leaveRoom,
		offAnnouncementSent,
		offDashboardRoomUsersUpdated,
		offDrawRequest,
		offDrawResponse,
		offGameStarted,
		offMovePiece,
		offPrivateMessageSent,
		offRoomCreated,
		offRoomDeleted,
		offRoomMessageSent,
		offRoomUsersUpdated,
		offSurrender,
		offUserKicked,
		onAnnouncementSent,
		onDrawRequest,
		onDrawResponse,
		onDashboardRoomUsersUpdated,
		onGameStarted,
		onMovePiece,
		onPrivateMessageSent,
		onRoomCreated,
		onRoomDeleted,
		onRoomMessageSent,
		onRoomUsersUpdated,
		onSurrender,
		onUserKicked,
		registerUser,
	}
}
