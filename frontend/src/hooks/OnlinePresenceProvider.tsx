import {
	useEffect,
	useMemo,
	useState,
	type ReactNode
} from "react"
import { getToken } from "common/helper"
import { useAPI } from "hooks/useAPI"
import { useSocket } from "hooks/useSocket"
import { APIResponse, PresenceStatus, UserAvatarType } from "types/Common"
import { OnlinePresenceContext, OnlinePresenceValue } from "./useOnlinePresence"

type PresenceUser = UserAvatarType & {
	status: PresenceStatus
}

type OnlinePresenceProviderProps = {
	count: number
	users: PresenceUser[]
}

type OnlinePresenceProviderState = {
	userId: number
	status: PresenceStatus
}

/**
 * Holds each present user's status ("online" | "busy" | "inactive" | "offline")
 * for the whole subtree: seeded once from the active list and kept live
 * via `presence-changed` socket broadcasts. Mount once so every consumer
 * shares a single fetch and a single subscription. Users not in the map are "offline".
 */
export function OnlinePresenceProvider({ children }: { children: ReactNode }) {
	const { getOnlineUsers } = useAPI()
	const {
		offPresenceChanged,
		onPresenceChanged
	} = useSocket()
	const [statuses, setStatuses] = useState<Map<number, PresenceStatus>>(new Map())

	useEffect(() => {
		let cancelled = false

		const loadStatuses = async () => {
			const token = getToken()
			if (!token) return

			const response = await getOnlineUsers(token) as APIResponse<OnlinePresenceProviderProps>
			if (cancelled) return
			if (response?.success && response.data) {
				setStatuses(new Map(response.data.users.map(user => [user.id, user.status])))
			}
		}

		const handlePresenceChanged = (data: OnlinePresenceProviderState) => {
			setStatuses(prev => {
				const next = new Map(prev)
				if (data.status === "offline") {
					next.delete(data.userId)
				} else {
					next.set(data.userId, data.status)
				}
				return next
			})
		}

		loadStatuses()
		onPresenceChanged(handlePresenceChanged)

		return () => {
			cancelled = true
			offPresenceChanged(handlePresenceChanged)
		}
		// getOnlineUsers is recreated each render; intentionally excluded so the
		// effect only re-subscribes when the socket handlers change.
	}, [offPresenceChanged, onPresenceChanged])

	const value = useMemo<OnlinePresenceValue>(() => ({
		getStatus: (userId?: number | null) =>
			userId != null ? (statuses.get(userId) ?? "offline") : "offline",
		isOnline: (userId?: number | null) =>
			userId != null && statuses.get(userId) === "online"
	}), [statuses])

	return (
		<OnlinePresenceContext.Provider value={value}>
			{children}
		</OnlinePresenceContext.Provider>
	)
}
