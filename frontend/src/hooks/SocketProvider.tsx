import { logger } from "common/helper"
import { useEffect, useRef, useState, type ReactNode } from "react"
import { io, Socket } from "socket.io-client"
import { SocketContext } from "./useSocket"

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

/**
 * Provides a single shared socket connection to the whole subtree.
 * Mount it once above every component that calls useSocket(), so all
 * consumers share one connection instead of each opening its own.
 */
export function SocketProvider({ children }: { children: ReactNode }) {
	const socketRef = useRef<Socket | null>(null)
	const [isConnected, setIsConnected] = useState(false)

	// Create the socket eagerly during render so socketRef.current is ready
	// before any child effect runs. Child effects run before the parent's
	// effect, so initializing inside useEffect would leave consumers seeing
	// a null socket on first mount and failing to register their listeners.
	if (socketRef.current === null) {
		socketRef.current = io(API_BASE_URL, {
			reconnection: true,
			reconnectionDelay: 1000,
			reconnectionDelayMax: 5000,
			reconnectionAttempts: 10,
			transports: ["websocket"],
			path: "/socket.io",
		})
	}

	useEffect(() => {
		const socket = socketRef.current
		if (!socket) {
			return
		}

		socket.on("connect", () => {
			const transport = socket.io.engine.transport?.name || "unknown"
			const getTime = new Date().toISOString
			logger.log(`[Socket.io] [${getTime()}] Connected: ${socket.id} Transport: ${transport}`)
			if (transport === "websocket") {
				logger.log(`[Socket.io] [${getTime()}] WebSocket connected`)
			}
			setIsConnected(true)
		})

		socket.io.engine.on("upgrade", (transport) => {
			const getTime = new Date().toISOString
			logger.log(`[Socket.io] [${getTime()}] Transport upgraded to: ${transport.name}`)
			if (transport.name === "websocket") {
				logger.log(`[Socket.io] [${getTime()}] WebSocket connected`)
			}
		})

		socket.on("disconnect", (reason) => {
			logger.log(`[Socket.io] [${new Date().toISOString()}] Disconnected, reason: ${reason}`)
			setIsConnected(false)
		})

		socket.on("connect_error", (error) => {
			logger.error(`[Socket.io] [${new Date().toISOString()}] Connection error: ${error.message}`)
		})

		socket.on("error", (error) => {
			logger.error(`[Socket.io] [${new Date().toISOString()}] Error: ${error.message}`)
		})

		if (socket.connected) {
			setIsConnected(true)
		}

		return () => {
			socket.disconnect()
			socketRef.current = null
		}
	}, [])

	return (
		<SocketContext.Provider value={{ isConnected, socketRef }}>
			{children}
		</SocketContext.Provider>
	)
}
