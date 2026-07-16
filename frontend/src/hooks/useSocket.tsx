import { logger } from "common/helper"
import {
	createContext,
	useCallback,
	useContext,
	type RefObject
} from "react"
import { Socket } from "socket.io-client"

export type SocketContextValue = {
	isConnected: boolean
	socketRef: RefObject<Socket | null>
}

// The Provider lives in SocketProvider.tsx
export const SocketContext = createContext<SocketContextValue | null>(null)

export function useSocket() {
	const context = useContext(SocketContext)
	if (!context) {
		throw new Error("useSocket must be used within a SocketProvider")
	}

	const { isConnected, socketRef } = context

	const onMovePiece = useCallback((callback: (data: any) => void) => {
		if (socketRef.current) {
			logger.log("[Socket.io] Registering piece-moved listener")
			socketRef.current.on("piece-moved", callback)
		} else {
			logger.log("[Socket.io] Socket not initialized for piece-moved listener")
		}
	}, [])

	const offMovePiece = useCallback((callback: (data: any) => void) => {
		if (socketRef.current) {
			// logger.log("[Socket.io] Unregistering piece-moved listener")
			socketRef.current.off("piece-moved", callback)
		}
	}, [])

	const joinRoom = useCallback((roomId: string | number, userId?: number) => {
		if (socketRef.current) {
			const payload = userId ? { roomId: roomId.toString(), userId } : roomId
			// logger.log("[Socket.io] Emitting join-room:", payload)
			socketRef.current.emit("join-room", payload)
		} else {
			logger.log("[Socket.io] Socket not initialized for join-room")
		}
	}, [])

	const leaveRoom = useCallback((roomId: string | number) => {
		if (socketRef.current) {
			// logger.log("[Socket.io] Emitting leave-room:", roomId)
			socketRef.current.emit("leave-room", roomId)
		}
	}, [])

	const emitPlayerMove = useCallback((moveData: any) => {
		if (socketRef.current) {
			// logger.log("[Socket.io] Emitting player-move event:", moveData)
			socketRef.current.emit("player-move", moveData)
		} else {
			logger.log("[Socket.io] Socket not initialized for player-move emit")
		}
	}, [])

	// Presence heartbeat — only emitted by the client while it has a visible tab.
	const emitPresencePing = useCallback((userId: number) => {
		if (socketRef.current) {
			socketRef.current.emit("presence-ping", { userId })
		} else {
			logger.log("[Socket.io] Socket not initialized for presence-ping emit")
		}
	}, [])

	const onPresenceChanged = useCallback((callback: (data: any) => void) => {
		if (socketRef.current) {
			socketRef.current.on("presence-changed", callback)
		} else {
			logger.log("[Socket.io] Socket not initialized for presence-changed listener")
		}
	}, [])

	const offPresenceChanged = useCallback((callback: (data: any) => void) => {
		if (socketRef.current) {
			socketRef.current.off("presence-changed", callback)
		}
	}, [])

	// ------------------------------------------------------------------------

	const emitDrawRequest = useCallback((roomId: string | number, gameId: string, requestUserId: number) => {
		if (socketRef.current) {
			socketRef.current.emit("draw-request", { roomId, gameId, requestUserId })
		} else {
			logger.log("[Socket.io] Socket not initialized for draw-request emit")
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
			logger.log("[Socket.io] Socket not initialized for draw-response emit")
		}
	}, [])

	const onDrawRequest = useCallback((callback: (data: any) => void) => {
		if (socketRef.current) {
			socketRef.current.on("draw-request", callback)
		} else {
			logger.log("[Socket.io] Socket not initialized for draw-request listener")
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
			logger.log("[Socket.io] Socket not initialized for draw-response listener")
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
			logger.log("[Socket.io] Socket not initialized for surrender emit")
		}
	}, [])

	const onSurrender = useCallback((callback: (data: any) => void) => {
		if (socketRef.current) {
			socketRef.current.on("surrender", callback)
		} else {
			logger.log("[Socket.io] Socket not initialized for surrender listener")
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
			logger.log("[Socket.io] Socket not initialized for room-users-updated listener")
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
			logger.log("[Socket.io] Socket not initialized for user-kicked listener")
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
			logger.log("[Socket.io] Socket not initialized for room-created listener")
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
			logger.log("[Socket.io] Socket not initialized for room-deleted listener")
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
			logger.log("[Socket.io] Socket not initialized for game-started listener")
		}
	}, [])

	const offGameStarted = useCallback((callback: (data: any) => void) => {
		if (socketRef.current) {
			socketRef.current.off("game-started", callback)
		}
	}, [])

	const onGameEnded = useCallback((callback: (data: any) => void) => {
		if (socketRef.current) {
			socketRef.current.on("game-ended", callback)
		} else {
			logger.log("[Socket.io] Socket not initialized for game-ended listener")
		}
	}, [])

	const offGameEnded = useCallback((callback: (data: any) => void) => {
		if (socketRef.current) {
			socketRef.current.off("game-ended", callback)
		}
	}, [])

	const onPerpetualCheckWarning = useCallback((callback: (data: any) => void) => {
		if (socketRef.current) {
			socketRef.current.on("perpetual-check-warning", callback)
		} else {
			logger.log("[Socket.io] Socket not initialized for perpetual-check-warning listener")
		}
	}, [])

	const offPerpetualCheckWarning = useCallback((callback: (data: any) => void) => {
		if (socketRef.current) {
			socketRef.current.off("perpetual-check-warning", callback)
		}
	}, [])

	const onGameUndo = useCallback((callback: (data: any) => void) => {
		if (socketRef.current) {
			socketRef.current.on("game-undo", callback)
		} else {
			logger.log("[Socket.io] Socket not initialized for game-undo listener")
		}
	}, [])

	const offGameUndo = useCallback((callback: (data: any) => void) => {
		if (socketRef.current) {
			socketRef.current.off("game-undo", callback)
		}
	}, [])

	const onRoomMessageSent = useCallback((callback: (data: any) => void) => {
		if (socketRef.current) {
			socketRef.current.on("room-message-sent", callback)
		} else {
			logger.log("[Socket.io] Socket not initialized for room-message-sent listener")
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
			logger.log("[Socket.io] Socket not initialized for register-user")
		}
	}, [])

	const onPrivateMessageSent = useCallback((callback: (data: any) => void) => {
		if (socketRef.current) {
			socketRef.current.on("private-message-sent", callback)
		} else {
			logger.log("[Socket.io] Socket not initialized for private-message-sent listener")
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
			logger.log("[Socket.io] Socket not initialized for announcement-sent listener")
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
			logger.log("[Socket.io] Socket not initialized for dashboard-room-users-updated listener")
		}
	}, [])

	const offDashboardRoomUsersUpdated = useCallback((callback: (data: any) => void) => {
		if (socketRef.current) {
			socketRef.current.off("dashboard-room-users-updated", callback)
		}
	}, [])

	const emitRoomInvite = useCallback((roomId: number, inviteeId: number, inviterId: number) => {
		if (socketRef.current) {
			socketRef.current.emit("room-invite", { roomId, inviteeId, inviterId })
		} else {
			logger.log("[Socket.io] Socket not initialized for room-invite emit")
		}
	}, [])

	const onRoomInvite = useCallback((callback: (data: any) => void) => {
		if (socketRef.current) {
			socketRef.current.on("room-invite", callback)
		} else {
			logger.log("[Socket.io] Socket not initialized for room-invite listener")
		}
	}, [])

	const offRoomInvite = useCallback((callback: (data: any) => void) => {
		if (socketRef.current) {
			socketRef.current.off("room-invite", callback)
		}
	}, [])

	return {
		isConnected,

		emitDrawRequest,
		emitDrawResponse,
		emitPlayerMove,
		emitPresencePing,
		emitRoomInvite,
		emitSurrender,
		joinRoom,
		leaveRoom,
		offAnnouncementSent,
		offDashboardRoomUsersUpdated,
		offDrawRequest,
		offDrawResponse,
		offGameEnded,
		offGameStarted,
		offGameUndo,
		offMovePiece,
		offPerpetualCheckWarning,
		offPresenceChanged,
		offPrivateMessageSent,
		offRoomCreated,
		offRoomDeleted,
		offRoomInvite,
		offRoomMessageSent,
		offRoomUsersUpdated,
		offSurrender,
		offUserKicked,
		onAnnouncementSent,
		onDrawRequest,
		onDrawResponse,
		onGameEnded,
		onDashboardRoomUsersUpdated,
		onGameStarted,
		onGameUndo,
		onMovePiece,
		onPerpetualCheckWarning,
		onPresenceChanged,
		onPrivateMessageSent,
		onRoomCreated,
		onRoomDeleted,
		onRoomInvite,
		onRoomMessageSent,
		onRoomUsersUpdated,
		onSurrender,
		onUserKicked,
		registerUser,
	}
}
