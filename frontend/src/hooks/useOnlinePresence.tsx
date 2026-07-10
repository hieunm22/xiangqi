import { createContext, useContext } from "react"
import { PresenceStatus } from "types/Common"

export type OnlinePresenceValue = {
	getStatus: (userId: number | null | undefined) => PresenceStatus
	isOnline: (userId: number | null | undefined) => boolean
}

// The Provider lives in OnlinePresenceProvider.tsx
export const OnlinePresenceContext = createContext<OnlinePresenceValue | null>(null)

export function useOnlinePresence() {
	const context = useContext(OnlinePresenceContext)
	if (!context) {
		throw new Error("useOnlinePresence must be used within an OnlinePresenceProvider")
	}
	return context
}
