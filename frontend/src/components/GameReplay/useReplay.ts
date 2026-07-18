import {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState
} from "react"
import { diffFenMove, getToken } from "common/helper"
import {
	fenToBoard,
	findCheckingPieces,
	getCapturedPiecesFromHistory,
	resolveSideUsers
} from "pages/Room/common"
import { useAPI } from "hooks/useAPI"
import {
	CapturedPieces,
	CellProps,
	NullableCellProps,
	Team
} from "types/GameState"
import { GameMovements, MoveProps, RoomUser } from "pages/Room/types"
import { GameHistoryUser } from "components/Layout/types"
import { PendingCommit, ReplayEndInfo, UseReplayArgs } from "./types"

const END_REASON_PLAYER_FIELD: Record<string, keyof GameMovements> = {
	surrender: "surrender_id",
	leave: "leave",
	timeout: "timeout",
	"per-move-timeout": "timeout",
	checkmate: "winner_id",
	"perpetual-check": "winner_id"
}

const resolveEndInfo = (users: GameHistoryUser[], last?: GameMovements): ReplayEndInfo => {
	const reason = last?.end_reason ?? ""
	const field = reason ? END_REASON_PLAYER_FIELD[reason] : undefined
	const playerId = field && last ? (last[field] as number | undefined) : undefined
	const userFind = users.find(user => user.id === playerId)
	const playerName = playerId != null
		? userFind?.display_name ?? null
		: null
	const playerAvatar = playerId != null
		? userFind?.avatar_url ?? null
		: null
	return { playerAvatar, playerName, reason }
}

// The board slide is driven by the `.piece-wrapper` CSS transition (0.5s)
const ANIMATION_MS = 520
const STEP_NORMAL_MS = 1000
const STEP_FAST_MS = 1500
const STEP_VFAST_MS = 2000

// Playback speed options (YouTube-style). Multiplier is relative to normal speed.
export const REPLAY_SPEEDS: { label: string; value: number }[] = [
	{ label: "1x", value: STEP_VFAST_MS },
	{ label: "1.5x", value: STEP_FAST_MS },
	{ label: "2x", value: STEP_NORMAL_MS },
]

const EMPTY_CAPTURED: CapturedPieces = { red: [], black: [] }

const useReplay = ({ game, onEnd }: UseReplayArgs) => {
	const { getGameMovementHistory } = useAPI()

	const [board, setBoard] = useState<NullableCellProps[]>([])
	const [capturedPieces, setCapturedPieces] = useState<CapturedPieces>(EMPTY_CAPTURED)
	const [checkingPieces, setCheckingPieces] = useState<number[]>([])
	const [currentTurn, setCurrentTurn] = useState<Team>("red")
	const [isLoading, setIsLoading] = useState(false)
	const [isPlaying, setIsPlaying] = useState(false)
	const [previousMove, setPreviousMove] = useState<MoveProps | null>(null)
	const [redFirst, setRedFirst] = useState(true)
	const [stepIndex, setStepIndex] = useState(0)
	const [stepMs, setStepMsState] = useState(STEP_NORMAL_MS)
	const [totalMoves, setTotalMoves] = useState(0)

	const movementsRef = useRef<GameMovements[]>([])
	const stepRef = useRef(0)
	const playingRef = useRef(false)
	const stepMsRef = useRef(STEP_NORMAL_MS)
	const tickTimerRef = useRef<number | null>(null)
	const commitTimerRef = useRef<number | null>(null)
	const pendingCommitRef = useRef<PendingCommit | null>(null)
	const onEndRef = useRef(onEnd)
	const usersRef = useRef<GameHistoryUser[]>(game?.users ?? [])

	const gameId = useMemo(() => game?.game.gameId ?? null, [game])

	const commitStep = useCallback((pending: PendingCommit) => {
		const { step, diff } = pending
		const movements = movementsRef.current
		const nextBoard = fenToBoard(movements[step].fen)
		const team = movements[step].team
		stepRef.current = step
		setStepIndex(step)
		setBoard(nextBoard)
		setCurrentTurn(team)
		setPreviousMove(diff)
		setCapturedPieces(getCapturedPiecesFromHistory(movements.slice(0, step + 1)))
		// Highlight enemy pieces checking the side-to-move's general (like the live board).
		setCheckingPieces(findCheckingPieces(nextBoard, team))
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
			const endInfo = resolveEndInfo(usersRef.current, movements[movements.length - 1])
			onEndRef.current(endInfo)
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
		}, stepMsRef.current)
	}, [stepForward])

	const setStepMs = useCallback((ms: number) => {
		stepMsRef.current = ms
		setStepMsState(ms)
		// Apply the new speed right away if a playback tick is already scheduled.
		if (playingRef.current && tickTimerRef.current !== null) {
			window.clearTimeout(tickTimerRef.current)
			tickTimerRef.current = null
			scheduleTick()
		}
	}, [scheduleTick])

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
		const diff = clamped > 0
			? diffFenMove(movements[clamped - 1].fen, movements[clamped].fen)
			: null
		const move = diff ? { from: diff.oldIndex, to: diff.newIndex } : null
		commitStep({ step: clamped, diff: move })
	}, [commitStep, pause])

	useEffect(() => {
		onEndRef.current = onEnd
		usersRef.current = game?.users ?? []
	})

	// Load the move history whenever the popup opens for a game.
	useEffect(() => {
		if (game === null || !gameId) {
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

	const { top, bottom } = useMemo(() => {
		if (!game) {
			return { top: null, bottom: null }
		}
		// Each player's color comes from player-history (game_users.team).
		const joinedUsers: RoomUser[] = game.users.map(user => ({
			id: user.id,
			display_name: user.display_name,
			avatar_url: user.avatar_url,
			back_ready: null,
			team: user.team,
			total_amount: 0,
			is_bot: false
		}))

		const sides = resolveSideUsers(joinedUsers, redFirst)
		// Fallback for games without a persisted color mapping: keep both players
		// visible by seating them in list order.
		if (!sides.top && !sides.bottom && joinedUsers.length === 2) {
			return { top: joinedUsers[1], bottom: joinedUsers[0] }
		}
		return sides
	}, [game, redFirst])

	return {
		board,
		bottom,
		capturedPieces,
		checkingPieces,
		currentTurn,
		isLoading,
		isPlaying,
		previousMove,
		stepIndex,
		stepMs,
		top,
		totalMoves,

		goToStep,
		setStepMs,
		togglePlay,
	}
}

export default useReplay
