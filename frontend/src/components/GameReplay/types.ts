import { EmptyVoid, NumberVoid } from "types/Common"
import { GameType } from "common/variants"
import { CapturedPieces, NullableCellProps, Team } from "types/GameState"
import { GameHistoryItem } from "components/Layout/types"
import { MoveProps } from "pages/Room/types"

export interface GameReplayPopupProps {
	game: GameHistoryItem | null
	onClose: () => void
}

export interface UseReplayArgs {
	gameId: string | null
	open: boolean
}

export interface UseReplayResult {
	board: NullableCellProps[]
	capturedPieces: CapturedPieces
	currentTurn: Team
	gameType: GameType
	isLoading: boolean
	isPlaying: boolean
	previousMove: MoveProps | null
	redFirst: boolean
	stepIndex: number
	stepMs: number
	totalMoves: number

	goToStep: NumberVoid
	setStepMs: NumberVoid
	togglePlay: EmptyVoid
}

export interface PendingCommit {
	step: number
	diff: MoveProps | null
}