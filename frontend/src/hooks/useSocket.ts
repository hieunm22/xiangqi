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
			console.log("[Socket.io Client] Connected:", socket.id, "Transport:", transport)
			if (transport === "websocket") {
				console.log("[Socket.io Client] WebSocket connected")
			}
			setIsConnected(true)
		})

		socket.io.engine.on("upgrade", (transport) => {
			console.log("[Socket.io Client] Transport upgraded to:", transport.name)
			if (transport.name === "websocket") {
				console.log("[Socket.io Client] WebSocket connected")
			}
		})

		socket.on("disconnect", (reason) => {
			console.log("[Socket.io Client] Disconnected, reason:", reason)
			setIsConnected(false)
		})

		socket.on("connect_error", (error) => {
			console.error("[Socket.io Client] Connection error:", error.message)
		})

		socket.on("error", (error) => {
			console.error("[Socket.io Client] Error:", error.message)
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

	return {
		isConnected,

		emitPlayerMove,
		joinRoom,
		leaveRoom,
		offMovePiece,
		onMovePiece,
	}
}
