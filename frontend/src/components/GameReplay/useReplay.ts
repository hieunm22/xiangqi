import {
	useCallback,
	useEffect,
	useRef,
	useState
} from "react"
import { diffFenMove, getToken } from "common/helper"
import { fenToBoard, getCapturedPiecesFromHistory } from "pages/Room/common"
import { useAPI } from "hooks/useAPI"
import {
	CapturedPieces,
	CellProps,
	NullableCellProps,
	Team
} from "types/GameState"
import {
	GameMovements,
	HistoryData,
	MoveProps
} from "pages/Room/types"
import {
	PendingCommit,
	UseReplayArgs,
	UseReplayResult
} from "./types"

// The board slide is driven by the `.piece-wrapper` CSS transition (0.5s)
const ANIMATION_MS = 520
const STEP_MS = 1500

const EMPTY_CAPTURED: CapturedPieces = { red: [], black: [] }



const useReplay = ({ gameId, open }: UseReplayArgs): UseReplayResult => {
	const { getGameMovementHistory } = useAPI()

	const [board, setBoard] = useState<NullableCellProps[]>([])
	const [capturedPieces, setCapturedPieces] = useState<CapturedPieces>(EMPTY_CAPTURED)
	const [currentTurn, setCurrentTurn] = useState<Team>("red")
	const [isLoading, setIsLoading] = useState(false)
	const [isPlaying, setIsPlaying] = useState(false)
	const [previousMove, setPreviousMove] = useState<MoveProps | null>(null)
	const [redFirst, setRedFirst] = useState(true)
	const [stepIndex, setStepIndex] = useState(0)
	const [totalMoves, setTotalMoves] = useState(0)

	const movementsRef = useRef<GameMovements[]>([])
	const stepRef = useRef(0)
	const playingRef = useRef(false)
	const tickTimerRef = useRef<number | null>(null)
	const commitTimerRef = useRef<number | null>(null)
	const pendingCommitRef = useRef<PendingCommit | null>(null)

	const commitStep = useCallback((pending: PendingCommit) => {
		const { step, diff } = pending
		const movements = movementsRef.current
		stepRef.current = step
		setStepIndex(step)
		setBoard(fenToBoard(movements[step].fen))
		setCurrentTurn(movements[step].team)
		setPreviousMove(diff)
		setCapturedPieces(getCapturedPiecesFromHistory(movements.slice(0, step + 1) as unknown as HistoryData[]))
	}, [])

	const flushPendingCommit = useCallback(() => {
		if (commitTimerRef.current !== null) {
			window.clearTimeout(commitTimerRef.current)
			commitTimerRef.current = null
		}
		if (pendingCommitRef.current) {
			const { step, diff } = pendingCommitRef.current
			pendingCommitRef.current = null
			commitStep({ step, diff })
		}
	}, [commitStep])

	const pause = useCallback(() => {
		playingRef.current = false
		setIsPlaying(false)
		if (tickTimerRef.current !== null) {
			window.clearTimeout(tickTimerRef.current)
			tickTimerRef.current = null
		}
		flushPendingCommit()
	}, [flushPendingCommit])

	// Advance one move; animate the sliding piece when `animate` is set.
	const stepForward = useCallback((animate: boolean) => {
		flushPendingCommit()
		const movements = movementsRef.current
		const current = stepRef.current
		const next = current + 1
		if (next >= movements.length) {
			pause()
			return
		}

		const diff = diffFenMove(movements[current].fen, movements[next].fen)
		const move: MoveProps | null = diff ? { from: diff.oldIndex, to: diff.newIndex } : null

		if (animate && diff) {
			const animatingBoard = fenToBoard(movements[current].fen)
			const source = animatingBoard[diff.oldIndex] as CellProps
			animatingBoard[diff.oldIndex] = { ...source, animateTo: diff.newIndex }
			setBoard(animatingBoard)

			pendingCommitRef.current = { step: next, diff: move }
			commitTimerRef.current = window.setTimeout(() => {
				commitTimerRef.current = null
				pendingCommitRef.current = null
				commitStep({ step: next, diff: move })
			}, ANIMATION_MS)
		} else {
			commitStep({ step: next, diff: move })
		}
	}, [commitStep, flushPendingCommit, pause])

	const scheduleTick = useCallback(() => {
		if (!playingRef.current) {
			return
		}
		tickTimerRef.current = window.setTimeout(() => {
			stepForward(true)
			scheduleTick()
		}, STEP_MS)
	}, [stepForward])

	const togglePlay = useCallback(() => {
		if (playingRef.current) {
			pause()
			return
		}
		if (movementsRef.current.length <= 1) {
			return
		}
		// Restart from the beginning when paused at the last move.
		if (stepRef.current >= movementsRef.current.length - 1) {
			commitStep({ step: 0, diff: null })
		}
		playingRef.current = true
		setIsPlaying(true)
		stepForward(true)
		scheduleTick()
	}, [commitStep, pause, scheduleTick, stepForward])

	const goToStep = useCallback((step: number) => {
		pause()
		const movements = movementsRef.current
		if (movements.length === 0) {
			return
		}
		const clamped = Math.max(0, Math.min(step, movements.length - 1))
		const diff = clamped > 0 ? diffFenMove(movements[clamped - 1].fen, movements[clamped].fen) : null
		const move = diff ? { from: diff.oldIndex, to: diff.newIndex } : null
		commitStep({ step: clamped, diff: move })
	}, [commitStep, pause])

	// Load the move history whenever the popup opens for a game.
	useEffect(() => {
		if (!open || !gameId) {
			return
		}

		let cancelled = false
		const load = async () => {
			const token = getToken()
			if (!token) {
				return
			}
			setIsLoading(true)
			const response = await getGameMovementHistory(token, gameId)
			if (cancelled) {
				return
			}
			setIsLoading(false)

			const records = response?.success && response.data ? [...response.data] : []
			records.sort((a, b) => a.time_stamp - b.time_stamp)
			movementsRef.current = records

			if (records.length === 0) {
				setBoard([])
				setTotalMoves(0)
				return
			}

			setRedFirst(records[0].team === "red")
			setTotalMoves(records.length - 1)
			commitStep({ step: 0, diff: null })
		}

		load()
		return () => {
			cancelled = true
		}
		// getGameMovementHistory (a fresh ref each render) and commitStep are intentionally
		// omitted: re-fetch only when the popup opens for a game. Including the useAPI fn
		// would re-fetch and reset to move 0 on every tick.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [open, gameId])

	// Stop timers when the popup closes or the component unmounts.
	useEffect(() => {
		if (!open) {
			pause()
		}
	}, [open, pause])

	useEffect(() => () => {
		pause()
	}, [pause])

	return {
		board,
		capturedPieces,
		currentTurn,
		isLoading,
		isPlaying,
		previousMove,
		redFirst,
		stepIndex,
		totalMoves,

		goToStep,
		togglePlay
	}
}

export default useReplay
