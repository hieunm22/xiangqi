import { GameHistoryItem } from "components/Layout/types"
import { MoveProps } from "pages/Room/types"

export interface GameReplayPopupProps {
	game: GameHistoryItem | null
	onClose: () => void
}

export interface ReplayEndInfo {
	reason: string
	playerName: string | null
	playerAvatar: string | null
}

export interface UseReplayArgs {
	game: GameHistoryItem | null
	onEnd: (info: ReplayEndInfo) => void
}

export interface PendingCommit {
	step: number
	diff: MoveProps | null
}