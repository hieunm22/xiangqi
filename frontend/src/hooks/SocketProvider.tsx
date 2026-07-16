import { useEffect, useRef, useState, type ReactNode } from "react"
import { io, Socket } from "socket.io-client"
import { resolveBackendBaseUrl } from "common/backend-url"
import { logger } from "common/helper"
import { SocketContext } from "./useSocket"

const API_BASE_URL = resolveBackendBaseUrl()

/**
 * Provides a single shared socket to the whole subtree.
 * Mount once above all useSocket() consumers to share one connection.
 */
export function SocketProvider({ children }: { children: ReactNode }) {
	const socketRef = useRef<Socket | null>(null)
	const [isConnected, setIsConnected] = useState(false)

	// Create socket eagerly during render (before child effects) so socketRef.current
	// is available on first mount; useEffect would be too late for child listeners.
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
			const getTime = () => new Date().toISOString()
			logger.log(`[Socket.io] [${getTime()}] Connected: ${socket.id} Transport: ${transport}`)
			if (transport === "websocket") {
				logger.log(`[Socket.io] [${getTime()}] WebSocket connected`)
			}
			setIsConnected(true)
		})

		socket.io.engine.on("upgrade", (transport) => {
			const getTime = () => new Date().toISOString()
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
