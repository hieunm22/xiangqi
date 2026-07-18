import {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState
} from "react"
import { useNavigate, useParams } from "react-router-dom"
import { HOME_PATH, LOGIN_PATH } from "common/constant"
import {
	CAPTURE_SOUND_URL,
	EMPTY_BOARD_FEN,
	GAME_START_SOUND_URL,
	MOVE_SOUND_URL
} from "./constant"
import { PopupState } from "common/enums"
import { openAlert } from "components/AlertProvider/helper"
import { RoomChatMessage } from "components/ChatDialog/types"
import { openConfirm } from "components/ConfirmProvider/helper"
import { openSnackbar } from "components/SnackbarProvider/helper"
import {
	diffFenMove,
	getAvailableMoves,
	getCurrentUserId,
	getToken,
	logger,
} from "common/helper"
import {
	applyMove,
	boardToFen,
	countLegalMoves,
	fenToBoard,
	findCheckingPieces,
	getCapturedPiecesFromHistory,
	getMoveDirection,
	getPieceFromCharacter,
	getTeamFromPieceChar,
	markerClass,
	playSound,
	resolveSideUsers,
} from "./common"
import { useAPI } from "hooks/useAPI"
import { useSocket } from "hooks/useSocket"
import useAutoTitle from "hooks/useAutoTitle"
import useToolkit from "hooks/useToolkit"
import useGameClock from "./useGameClock"
import { translate } from "locales/translate"
import { setIsCurrentRoomPlayer, setIsInGame, setPopup } from "toolkit/slice/game"
import { APIResponse, FenMoveDiffResult } from "types/Common"
import { GameInfo } from "types/Entities"
import {
	CapturedPieces,
	NullableCellProps,
	PieceCharacter,
	Team
} from "types/GameState"
import {
	ClockSnapshot,
	DrawRequest,
	GameEndReason,
	GameMovements,
	HistoryData,
	MovePieceRequest,
	MoveProps,
	RemoteMoveProps,
	RoomActionButton,
	RoomChatDialogContextValue,
	RoomInfo,
	RoomInfoData,
	RoomSettingsDialogContextValue,
	RoomUser,
	StartGameBody,
	SurrenderRequest,
	VerifyStateResponseData,
} from "./types"

const useRoomHook = () => {
	const POST_GAME_BACK_COUNTDOWN_SECONDS = 15

	useAutoTitle("page.home.title")
	const { state, dispatch } = useToolkit()
	const {
		backToRoom,
		changeTeam,
		drawGame,
		getGameMovementHistory,
		getRoomById,
		joinRoom,
		leaveRoom,
		movePiece,
		startRoom,
		surrenderGame,
		undoGame,
		verifyGameState,
	} = useAPI()

	const {
		isConnected,
		joinRoom: socketJoinRoom,
		leaveRoom: socketLeaveRoom,
		emitPlayerMove,
		emitDrawRequest,
		emitDrawResponse,
		emitSurrender,
		offDrawRequest,
		offDrawResponse,
		offGameEnded,
		offGameStarted,
		offGameUndo,
		offMovePiece,
		offPerpetualCheckWarning,
		offRoomMessageSent,
		offRoomUsersUpdated,
		offSurrender,
		offUserKicked,
		onDrawRequest,
		onDrawResponse,
		onGameEnded,
		onGameStarted,
		onGameUndo,
		onMovePiece,
		onPerpetualCheckWarning,
		onRoomMessageSent,
		onRoomUsersUpdated,
		onSurrender,
		onUserKicked,
	} = useSocket()

	const [room, setRoom] = useState<RoomInfo | null>(null)
	const [joinedUsers, setJoinedUsers] = useState<RoomUser[]>([])
	const [game, setGame] = useState<GameInfo | null>(null)
	const [history, setHistory] = useState<HistoryData[]>([])
	const [isOpen, setIsOpen] = useState(false)
	const [isRoomLoading, setIsRoomLoading] = useState(true)
	// Flip the board view 180° (change the viewing side)
	// while game state and all move logic keep using the real cell index
	const [isBoardRotated, setIsBoardRotated] = useState(false)
	const [openRoomChat, setOpenRoomChat] = useState(false)
	const [unreadChatCount, setUnreadChatCount] = useState(0)
	const [incomingChatMessage, setIncomingChatMessage] = useState<RoomChatMessage | null>(null)

	const [gameButtons, setGameButtons] = useState<RoomActionButton[]>([])
	const [board, setBoard] = useState<NullableCellProps[]>([])
	const [selected, setSelected] = useState<number | null>(null)
	const [availableMoves, setAvailableMoves] = useState<number[]>([])
	const [previousMove, setPreviousMove] = useState<MoveProps | null>(null)
	const [showConfetti, setShowConfetti] = useState(false)
	// Indices of pieces currently giving check to the side that is checked.
	const [checkingPieces, setCheckingPieces] = useState<number[]>([])
	const [capturedPieces, setCapturedPieces] = useState<CapturedPieces>({ red: [], black: [] })
	const [currentTurn, setCurrentTurn] = useState<Team>("red")
	const [isMovePending, setIsMovePending] = useState(false)
	const [topSideUser, setTopSideUser] = useState<RoomUser | null>(null)
	const [bottomSideUser, setBottomSideUser] = useState<RoomUser | null>(null)
	// Remote move waiting for its animation to finish before being committed to history
	const [pendingRemoteMove, setPendingRemoteMove] = useState<HistoryData | null>(null)
	const [pendingDrawRequest, setPendingDrawRequest] = useState<DrawRequest | null>(null)
	// Latest server countdown snapshot; useGameClock ticks it locally for display.
	const [clock, setClock] = useState<ClockSnapshot | null>(null)
	const boardRef = useRef(board)
	// Opponent's last move (from/to), keyed to the FEN it produces; captured in handleMovePiece.
	// History-based diff is unreliable in real time since local moves are never in history.
	const remoteMoveRef = useRef<RemoteMoveProps | null>(null)
	// Mirror the chat-open state into a ref so the room-message-sent listener can
	// decide whether to bump the unread badge without re-subscribing on toggle.
	const previousJoinedUsersRef = useRef<RoomUser[]>([])
	const processedGameEndRef = useRef<string | null>(null)
	const openRoomChatRef = useRef(openRoomChat)
	useEffect(() => {
		openRoomChatRef.current = openRoomChat
	}, [openRoomChat])
	const { id } = useParams()
	const roomId = Number(id)
	const navigate = useNavigate()
	const currentUserId = getCurrentUserId()

	// Team controlled by the logged-in player. Null for spectators
	const myTeam = useMemo<Team | null>(() => {
		const me = joinedUsers.find(user => user.id === currentUserId)
		return me?.team ?? null
	}, [joinedUsers, currentUserId])

	useEffect(() => {
		dispatch(setIsCurrentRoomPlayer(myTeam !== null))
		return () => {
			dispatch(setIsCurrentRoomPlayer(false))
		}
	}, [dispatch, myTeam])

	const isStartBlockedByBackReady = useMemo(() => {
		if (!room || room.status !== 1) {
			return false
		}

		return joinedUsers.some(user => !user.is_bot && user.team !== null && user.back_ready === false)
	}, [joinedUsers, room])

	const seatSet = useMemo(() => {
		const seatedTeams = new Set(
			joinedUsers
				.filter(user => user.team !== null)
				.map(user => user.team)
		)

		return seatedTeams
	}, [joinedUsers])

	// single source of truth shared by the buttons' visible/enabled props
	// and their click handlers
	const currentUser = joinedUsers.find(user => user.id === currentUserId)
	const isHost = room?.host_id === currentUserId
	const isWaiting = room?.status === 1
	const isPlaying = room?.status === 2 && game?.status === 1
	const isPlayer = myTeam !== null
	const hasAvailableSeat = seatSet.size < 2
	const bothSeatsFilled = seatSet.has("red") && seatSet.has("black")
	const allPlayersReady = bothSeatsFilled && !isStartBlockedByBackReady
	// >80% of balance disqualifies a challenger; free rooms and PvE never block.
	const canAffordBet = room && currentUser && currentUser.total_amount && room.pve_mode === false
		? (room.bet_amount === 0 || room.bet_amount * 10 <= currentUser.total_amount * 8)
		: true

	const submitBackToRoom = useCallback(async (gameId: string) => {
		const token = getToken()
		if (!token || !Number.isInteger(roomId) || roomId <= 0) {
			return
		}

		const response = await backToRoom(token, {
			gameId,
			roomId
		})

		if (!response?.success) {
			logger.warn("[Room] back-to-room failed", response)
		}
	}, [backToRoom, roomId])

	const buildPostGameAlertMessage = useCallback(
		(isWinner: boolean, secondsLeft: number, status?: string, isDraw = false) => {
			let resultText = isWinner ? "room.messages.you-win" : "room.messages.you-lose"
			if (isDraw) {
				resultText = "room.messages.you-draw"
			} else if (status === "perpetual-check") {
				// show the reason to let both side to know the game ended on the 長將 rule.
				resultText = isWinner
					? "room.messages.you-win-perpetual-check"
					: "room.messages.you-lose-perpetual-check"
			} else if (status === "per-move-timeout") {
				// Per-move timeout is an unconditional win/loss (never a draw).
				resultText = isWinner
					? "room.messages.you-win-per-move-timeout"
					: "room.messages.you-lose-per-move-timeout"
			}
			return translate("room.messages.auto-back-countdown").format(
				translate(resultText),
				secondsLeft)
		}, [])

	// Spectator end-of-game message: names winner and reason (or announces draw).
	// Falls back to a generic message when the winner can't be resolved.
	const buildSpectatorEndMessage = useCallback(
		(status: string, winnerId: number | null): string => {
			if (winnerId === null) {
				return translate("room.messages.spectator-draw")
			}
			const winner = joinedUsers.find(user => user.id === winnerId)
			const keyByStatus: Record<string, string> = {
				checkmate: "room.messages.spectator-win-checkmate",
				stalemate: "room.messages.spectator-win-stalemate",
				timeout: "room.messages.spectator-win-timeout",
				"per-move-timeout": "room.messages.spectator-win-per-move-timeout",
				"perpetual-check": "room.messages.spectator-win-perpetual-check"
			}
			const key = keyByStatus[status]
			if (!winner || !key) {
				return translate("room.messages.game-ended")
			}
			return translate(key).format(winner.display_name)
		}, [joinedUsers])

	const handleGameEnded = useCallback(async (data: {
		gameId: string
		status: GameEndReason
		winnerId: number | null
	}) => {
		const dedupeKey = `${data.gameId}-${data.status}-${data.winnerId ?? "draw"}`
		if (processedGameEndRef.current === dedupeKey) {
			return
		}
		processedGameEndRef.current = dedupeKey

		const isWinner = data.winnerId !== null && currentUserId === data.winnerId
		const isDraw = data.winnerId === null

		if (isWinner) {
			setShowConfetti(true)
		}

		if (myTeam !== null) {
			const alertMessage = buildPostGameAlertMessage(
				isWinner,
				POST_GAME_BACK_COUNTDOWN_SECONDS,
				data.status,
				isDraw
			)

			await openAlert({
				title: "popup.alert.title",
				message: alertMessage,
				okLabel: "room.messages.back-to-room",
				countdownSeconds: POST_GAME_BACK_COUNTDOWN_SECONDS,
				countdownMessageBuilder: secondsLeft => buildPostGameAlertMessage(
					isWinner,
					secondsLeft,
					data.status,
					isDraw
				)
			})

			await submitBackToRoom(data.gameId)
		} else {
			// Spectator: no win/lose alert, just a neutral snackbar naming the result.
			openSnackbar({
				avatar: null,
				message: buildSpectatorEndMessage(data.status, data.winnerId),
				severity: "info",
				duration: 5000
			})
		}

		resetToWaitingRoom()
		setShowConfetti(false)
		await enforcePostGameBalance()
	}, [buildPostGameAlertMessage, buildSpectatorEndMessage, currentUserId, myTeam, submitBackToRoom])

	// Reset client state to the post-game "waiting" view (room.status === 1, no active game)
	const resetToWaitingRoom = () => {
		setRoom(prev => prev ? { ...prev, status: 1 } : prev)
		setGame(null)
		setClock(null)
		setHistory([])
		setAvailableMoves([])
		const emptyBoard = fenToBoard(EMPTY_BOARD_FEN)
		setBoard(emptyBoard)
		setSelected(null)
		setPreviousMove(null)
		setCheckingPieces([])
		setCapturedPieces({ red: [], black: [] })
	}

	// After a game ends, re-check the seated player's balance against the room's bet
	const enforcePostGameBalance = async () => {
		const token = getToken()
		if (!token || !Number.isInteger(roomId) || roomId <= 0) {
			return
		}

		// Refetch so the balance reflects the bet that was just settled.
		const roomInfoResponse: APIResponse<RoomInfoData> = await getRoomById(token, roomId)
		if (!roomInfoResponse || !roomInfoResponse.success || !roomInfoResponse.data) {
			return
		}

		const roomData = roomInfoResponse.data
		const users = (roomData.users || []) as RoomUser[]
		setJoinedUsers(users)
		setRoom(roomData.room)

		const betAmount = roomData.room.bet_amount
		const me = users.find(user => user.id === currentUserId)
		// Free rooms never lock anyone out, and spectators have no stake.
		if (betAmount <= 0 || !me || me.team == null || me.total_amount === undefined) {
			return
		}

		// Integer-safe form of `bet_amount > total_amount * 0.8`.
		if (betAmount * 10 > me.total_amount * 8) {
			await openAlert({
				title: "popup.alert.title",
				message: "room.messages.insufficient-amount"
			})
			await leaveRoom(token, roomId)
			navigate(HOME_PATH)
		}
	}

	async function loadCurrentRoom() {
		setIsRoomLoading(true)
		const token = getToken()
		if (!token || !Number.isInteger(roomId) || roomId <= 0) {
			setIsRoomLoading(false)
			return
		}

		try {
			const roomInfoResponse: APIResponse<RoomInfoData> = await getRoomById(token, roomId)
			if (!roomInfoResponse || !roomInfoResponse.success || !roomInfoResponse.data) {
				// navigate to home if room doesn't exist or failed to load
				navigate(HOME_PATH)
				return
			}

			if (roomInfoResponse.data.room.game_type !== "xiangqi") {
				// do nothing if the room is not a Xiangqi game type
				return
			}

			const roomData = roomInfoResponse.data
			const roomUsers = (roomData.users || []) as RoomUser[]
			previousJoinedUsersRef.current = roomUsers

			const isUserAlreadyInRoom = roomUsers.some(user => user.id === currentUserId)

			if (!isUserAlreadyInRoom) {
				const joinRoomResponse = await joinRoom(token, roomId)
				setJoinedUsers(joinRoomResponse.data as RoomUser[])
			}
			else {
				setJoinedUsers(roomUsers)
			}

			setRoom(roomData.room)
			setGame(roomData.game)
			setClock(roomData.clock ?? null)
			setUnreadChatCount(roomData.chat.unread_count)

			if (!roomData.game) {
				setHistory([])
				setAvailableMoves([])
				setBoard(fenToBoard(EMPTY_BOARD_FEN))
				setSelected(null)
				setCurrentTurn(roomData.room.red_first ? "red" : "black")
				setPreviousMove(null)
				setCheckingPieces([])
				setCapturedPieces({ red: [], black: [] })
			}
		} finally {
			setIsRoomLoading(false)
		}
	}

	async function loadGameHistory() {
		if (!room || !game) {
			return
		}

		if (room.status === 2) {
			const token = getToken()
			const history: APIResponse<GameMovements[]> = await getGameMovementHistory(token, game.id)
			const userBlack = joinedUsers.find(user => user.team === "black")
			const userRed = joinedUsers.find(user => user.team === "red")

			// If a team is missing (e.g., in PvE mode before bot is added to joinedUsers),
			// defer the userId mapping to avoid errors
			if (!userBlack || !userRed) {
				setHistory(history.data as HistoryData[])
				return
			}

			const historyData = (history.data as HistoryData[]).map(m => {
				// because history.userId is the id of the player who made the next move
				m.userId = userBlack!.team === m.team ? userRed!.id : userBlack?.id
				return m
			})
			setHistory(historyData ?? [])
		}
	}

	function updateToState() {
		if (!room) {
			return
		}

		if (joinedUsers.length === 0) {
			return
		}

		let diff: FenMoveDiffResult | null = null
		if (history.length > 1) {
			const latest = history[history.length - 1]
			const prevLatest = history[history.length - 2]
			diff = diffFenMove(prevLatest.fen, latest.fen)
		}

		const { top, bottom } = resolveSideUsers(joinedUsers, room.red_first)
		setTopSideUser(top)
		setBottomSideUser(bottom)

		const menus: RoomActionButton[] = [
			{
				key: "start-room",
				icon: "fas fa-swords",
				label: "room.actions.start-room",
				onClick: handleStartGame,
				visible: isHost && isWaiting,
				enabled: isWaiting && allPlayersReady
			},
			{
				key: "rotate-board",
				icon: "fas fa-arrows-rotate",
				label: "room.actions.flip-board",
				onClick: handleRotateBoard,
				visible: true,
				enabled: true
			},
			{
				key: "challenge",
				icon: "fas fa-hand-rock",
				label: "room.actions.challenge",
				onClick: handleChallenge,
				visible: isWaiting && !isHost && !isPlayer,
				enabled: hasAvailableSeat && canAffordBet
			},
			{
				key: "leave-seat",
				icon: "fas fa-seat",
				label: "room.actions.leave-seat",
				onClick: handleLeaveSeat,
				visible: isWaiting && isPlayer && !isHost,
				enabled: true
			},
			{
				key: "undo",
				icon: "fas fa-rotate-left",
				label: "room.actions.undo",
				onClick: handleUndo,
				visible: isPlaying && room.pve_mode,
				enabled: isPlaying && room.pve_mode && isPlayer && history.length > 2
			},
			{
				key: "draw",
				icon: "fas fa-handshake",
				label: "room.actions.draw",
				onClick: handleDraw,
				visible: isPlaying,
				enabled: isPlaying && isPlayer
			},
			{
				key: "surrender",
				icon: "fas fa-flag",
				label: "room.actions.surrender",
				onClick: handleSurrender,
				visible: isPlaying,
				enabled: isPlaying && isPlayer
			},
			{
				key: "back-home",
				icon: "fas fa-left-from-bracket",
				label: "room.actions.back-home",
				onClick: handleBackToHome,
				visible: true,
				enabled: true
			},
		]

		setGameButtons(menus)

		if (history.length === 0) {
			setCurrentTurn(room && room.red_first ? "red" : "black")
			return
		}

		const nextCaptured = getCapturedPiecesFromHistory(history)
		const latest = history[history.length - 1]
		const fen = latest.fen as string
		const nextBoard = fenToBoard(fen)
		setCurrentTurn(latest.team as Team)

		// Always highlight the latest move regardless of who moved.
		let nextPreviousMove: MoveProps | null = null

		if (remoteMoveRef.current && remoteMoveRef.current.fen === latest.fen) {
			nextPreviousMove = { from: remoteMoveRef.current.from, to: remoteMoveRef.current.to }
		}
		else if (diff !== null) {
			nextPreviousMove = { from: diff.oldIndex, to: diff.newIndex }
		}

		// The side to move is the side that must answer a check.
		const nextCheckingPieces = findCheckingPieces(nextBoard, latest.team as Team)

		// teamTurn already applied above via setCurrentTurn(latest.team)
		setAvailableMoves([])
		setBoard(nextBoard)
		setSelected(null)
		setPreviousMove(nextPreviousMove)
		setCheckingPieces(nextCheckingPieces)
		// Merge new captures from history instead of replacing entirely
		setCapturedPieces(prev => ({
			red: nextCaptured.red.length > prev.red.length ? nextCaptured.red : prev.red,
			black: nextCaptured.black.length > prev.black.length ? nextCaptured.black : prev.black
		}))
	}

	const isInGame = room?.status === 2 && (game?.id ?? null) != null

	// Expose the in-game state globally
	useEffect(() => {
		dispatch(setIsInGame(isInGame))
	}, [dispatch, isInGame])

	useEffect(() => () => {
		dispatch(setIsInGame(false))
	}, [dispatch])

	useEffect(() => {
		loadCurrentRoom()
	}, [])

	useEffect(() => {
		loadGameHistory()
	}, [room?.status, game?.id])

	useEffect(() => {
		boardRef.current = board
	}, [board])

	useEffect(updateToState, [history, joinedUsers, room?.status, game?.status, game?.id])

	// Socket.io: Update joined users in host view when another user joins the room
	useEffect(() => {
		if (!isConnected || !Number.isInteger(roomId) || roomId <= 0) {
			return
		}

		const handleRoomUsersUpdated = (data: {
			roomId: string | number
			users: RoomUser[]
			hostId?: number | null
		}) => {
			if (!data || Number(data.roomId) !== roomId || !Array.isArray(data.users)) {
				return
			}

			// Detect new users joining and users leaving
			if (previousJoinedUsersRef.current.length > 0) {
				const previousUserIds = new Set(previousJoinedUsersRef.current.map(u => u.id))
				const currentUserIds = new Set(data.users.map(u => u.id))

				// Detect new users
				const newUsers = data.users.filter(u => !previousUserIds.has(u.id))
				newUsers.forEach(newUser => {
					if (newUser.id !== currentUserId) {
						openSnackbar({
							avatar: newUser.avatar_url,
							message: translate("room.notifications.joined").format(newUser.display_name),
							severity: "success",
							duration: 3000
						})
					}
				})

				// Detect users leaving
				const previousUsers = previousJoinedUsersRef.current.filter(u => !currentUserIds.has(u.id))
				previousUsers.forEach(leftUser => {
					if (leftUser.id !== currentUserId) {
						openSnackbar({
							avatar: leftUser.avatar_url,
							message: translate("room.notifications.left").format(leftUser.display_name),
							severity: "success",
							duration: 3000
						})
					}
				})
			}

			previousJoinedUsersRef.current = data.users
			setJoinedUsers(data.users)
			// The host can change when the current host leaves the room.
			if (data.hostId !== undefined) {
				setRoom(prev => prev ? { ...prev, host_id: data.hostId ?? null } : prev)
			}
		}

		onRoomUsersUpdated(handleRoomUsersUpdated)

		return () => {
			offRoomUsersUpdated(handleRoomUsersUpdated)
		}
	}, [isConnected, roomId, currentUserId, onRoomUsersUpdated, offRoomUsersUpdated])

	// Socket.io: on kick, leave the socket channel and redirect home.
	// Other clients see the seat list refresh via `room-users-updated`.
	useEffect(() => {
		if (!isConnected || !Number.isInteger(roomId) || roomId <= 0) {
			return
		}

		const handleUserKicked = async (data: { roomId: string | number; userId: number }) => {
			if (!data || Number(data.roomId) !== roomId || Number(data.userId) !== currentUserId) {
				return
			}

			socketLeaveRoom(roomId)
			await openAlert({
				title: "popup.alert.title",
				message: "kick-user.messages.you-were-kicked"
			})
			navigate(HOME_PATH)
		}

		onUserKicked(handleUserKicked)

		return () => {
			offUserKicked(handleUserKicked)
		}
	}, [isConnected, roomId, currentUserId, onUserKicked, offUserKicked, socketLeaveRoom, navigate])

	// Socket.io: Join room and listen for piece-moved events
	useEffect(() => {
		if (!isConnected || !Number.isInteger(roomId) || roomId <= 0) {
			return
		}

		const handleMovePiece = (moveRecord: HistoryData) => {
			// Skip if this move was sent by current user
			if (moveRecord.userId === currentUserId) {
				logger.log("[Room] Skipping piece move from self (userId:", moveRecord.userId, ")")
				return
			}

			if (!moveRecord?.fen) {
				return
			}

			if (moveRecord.clock) {
				setClock(moveRecord.clock)
			}

			const currentFen = boardToFen(boardRef.current)
			const newFen = moveRecord.fen
			const diff = diffFenMove(currentFen, newFen)
			// Remember this move so updateToState can highlight it once the FEN lands
			remoteMoveRef.current = diff !== null
				? {
					fen: newFen,
					from: diff.oldIndex,
					to: diff.newIndex,
					isCapture: diff.capturedCell !== null
				} : null
			const boardClone = boardRef.current.map(cell => {
				if (cell && diff && cell.id === diff.oldIndex) {
					const cellClone = { ...cell }
					cellClone.animateTo = diff.newIndex
					return cellClone
				}

				return cell
			})

			// Update board state first
			setBoard(boardClone)

			// Defer history update until the CSS transition completes (see onAnimateEnd).
			// Updating early would remount the animated piece and kill the transition.
			setPendingRemoteMove(moveRecord)
		}

		socketJoinRoom(roomId, currentUserId || undefined)
		onMovePiece(handleMovePiece)

		return () => {
			offMovePiece(handleMovePiece)
			socketLeaveRoom(roomId)
		}
	}, [isConnected, roomId, onMovePiece, offMovePiece, socketJoinRoom, socketLeaveRoom])

	// Socket.io: Listen for new room chat messages from other players
	useEffect(() => {
		if (!isConnected || !Number.isInteger(roomId) || roomId <= 0) {
			return
		}

		const handleRoomMessage = (message: RoomChatMessage & { userId?: number }) => {
			// Ignore our own message - the sender already appended it locally
			if (message.userId === currentUserId || message.sender?.id === currentUserId) {
				return
			}

			setIncomingChatMessage(message)
			// Only bump the unread badge while the chat dialog is closed
			if (!openRoomChatRef.current) {
				setUnreadChatCount(count => count + 1)
			}
		}

		onRoomMessageSent(handleRoomMessage)

		return () => {
			offRoomMessageSent(handleRoomMessage)
		}
	}, [isConnected, roomId, currentUserId, onRoomMessageSent, offRoomMessageSent])

	// Socket.io: Listen for draw request and response events
	useEffect(() => {
		if (!isConnected || !roomId) {
			return
		}

		const handleDrawRequest = (data: DrawRequest) => {
			if (game && (data.gameId !== game.id || data.requestUserId === currentUserId)) {
				return
			}
			setPendingDrawRequest(data)
		}

		const handleDrawResponse = async (data: {
			roomId: string | number
			gameId: string
			accepted: boolean
			requestUserId: number
			responseUserId?: number
		}) => {
			if (game && data.gameId !== game.id) {
				return
			}

			if (data.requestUserId !== currentUserId) {
				return
			}

			if (data.accepted) {
				await openAlert({
					title: "popup.alert.title",
					message: "room.messages.draw-accepted",
					okLabel: "room.messages.back-to-room"
				})
				await submitBackToRoom(data.gameId)
				resetToWaitingRoom()
				await enforcePostGameBalance()
			} else {
				await openAlert({
					title: "popup.alert.title",
					message: "room.messages.draw-rejected"
				})
			}
		}

		onDrawRequest(handleDrawRequest)
		onDrawResponse(handleDrawResponse)

		return () => {
			offDrawRequest(handleDrawRequest)
			offDrawResponse(handleDrawResponse)
		}
	}, [isConnected,
		roomId,
		game,
		currentUserId,
		onDrawRequest,
		offDrawRequest,
		onDrawResponse,
		offDrawResponse,
		submitBackToRoom
	])

	// Socket.io: Listen for surrender event and show alert with confetti effect
	useEffect(() => {
		if (!isConnected || !roomId) {
			return
		}

		const handleSurrender = async (data: SurrenderRequest) => {
			if (Number(data.roomId) !== roomId) {
				// Surrender event is for different room, ignoring
				return
			}

			if (game && data.gameId !== game.id) {
				return
			}

			if (data.surrenderingUserId === currentUserId) {
				return
			}

			// Trigger confetti animation
			setShowConfetti(true)
			const alertMessage = buildPostGameAlertMessage(true, POST_GAME_BACK_COUNTDOWN_SECONDS)

			await openAlert({
				title: "popup.alert.title",
				message: alertMessage,
				okLabel: "room.messages.back-to-room",
				countdownSeconds: POST_GAME_BACK_COUNTDOWN_SECONDS,
				countdownMessageBuilder: secondsLeft => buildPostGameAlertMessage(true, secondsLeft)
			})

			await submitBackToRoom(data.gameId)

			// Clear the board and reset to waiting-room view after alert is dismissed
			resetToWaitingRoom()

			// Auto-hide confetti after alert closes
			setShowConfetti(false)

			await enforcePostGameBalance()
		}

		onSurrender(handleSurrender)

		return () => {
			offSurrender(handleSurrender)
		}
	}, [
		isConnected,
		roomId,
		game,
		currentUserId,
		buildPostGameAlertMessage,
		onSurrender,
		offSurrender,
		submitBackToRoom
	])

	// Socket.io: Listen for game-ended event (checkmate/stalemate) and show
	// winner/loser/draw alert, then return both sides to waiting-room state.
	useEffect(() => {
		if (!isConnected || !roomId) {
			return
		}

		const handleGameEndedEvent = async (data: {
			roomId: string | number
			gameId: string
			status: GameEndReason
			winnerId: number | null
		}) => {
			if (!data || Number(data.roomId) !== roomId) {
				return
			}

			if (game && data.gameId !== game.id) {
				return
			}

			await handleGameEnded({
				gameId: data.gameId,
				status: data.status,
				winnerId: data.winnerId
			})
		}

		onGameEnded(handleGameEndedEvent)

		return () => {
			offGameEnded(handleGameEndedEvent)
		}
	}, [isConnected, roomId, game, onGameEnded, offGameEnded, handleGameEnded])

	// Socket.io: perpetual check warning. Checked side is notified;
	// checker (offender) is warned that one more repetition will forfeit the game.
	useEffect(() => {
		if (!isConnected || !roomId) {
			return
		}

		const handlePerpetualCheckWarning = (data: {
			roomId: string | number
			gameId: string
			offenderTeam: Team
			checkedTeam: Team
		}) => {
			if (Number(data.roomId) !== roomId) {
				return
			}
			if (game && data.gameId !== game.id) {
				return
			}
			if (myTeam === data.checkedTeam) {
				openSnackbar({
					avatar: null,
					message: translate("game.perpetual-check.warning-sent"),
					severity: "warning",
					duration: 4000
				})
			} else if (myTeam === data.offenderTeam) {
				void openAlert({
					title: "popup.alert.title",
					message: "game.perpetual-check.warning-self"
				})
			}
		}

		onPerpetualCheckWarning(handlePerpetualCheckWarning)

		return () => {
			offPerpetualCheckWarning(handlePerpetualCheckWarning)
		}
	}, [isConnected, roomId, game, myTeam, onPerpetualCheckWarning, offPerpetualCheckWarning])

	// Socket.io: Play the gong and initialize the board when a game starts in this room.
	// Fires for everyone in the room (host, opponent, spectators)
	useEffect(() => {
		if (!isConnected || !Number.isInteger(roomId) || roomId <= 0) {
			return
		}

		const handleGameStarted = (data: StartGameBody) => {
			if (!data || Number(data.roomId) !== roomId) {
				return
			}

			playSound(import.meta.env.VITE_PUBLIC_DISTRIBUTION + GAME_START_SOUND_URL)

			if (data.gameId) {
				const game = {
					id: data.gameId,
					room_id: roomId,
					winner_id: null,
					status: 1,
					bot_difficulty: data.bot_difficulty ?? null
				}
				setGame(game)
			}
			setRoom(currentRoom => currentRoom
				? { ...currentRoom, status: data.status ?? 2 }
				: currentRoom
			)
			setClock(data.clock ?? null)
		}

		onGameStarted(handleGameStarted)

		return () => {
			offGameStarted(handleGameStarted)
		}
	}, [isConnected, roomId, onGameStarted, offGameStarted])

	// Socket.io: mirror an opponent's undo (ignore our own — already rewound via HTTP).
	// Everyone else trims the same trailing moves and syncs to the rewound clock.
	useEffect(() => {
		if (!isConnected || !Number.isInteger(roomId) || roomId <= 0) {
			return
		}

		const handleGameUndo = (data: {
			gameId: string
			userId: number
			movesDeleted?: number
			clock?: ClockSnapshot | null
		}) => {
			if (!data || data.userId === currentUserId) {
				return
			}
			if (game && data.gameId !== game.id) {
				return
			}

			const movesDeleted = data.movesDeleted ?? 1
			setHistory(prev => prev.slice(0, Math.max(0, prev.length - movesDeleted)))
			setClock(data.clock ?? null)
			setSelected(null)
			setAvailableMoves([])
			playSound(import.meta.env.VITE_PUBLIC_DISTRIBUTION + MOVE_SOUND_URL)
		}

		onGameUndo(handleGameUndo)

		return () => {
			offGameUndo(handleGameUndo)
		}
	}, [isConnected, roomId, game, currentUserId, onGameUndo, offGameUndo])

	// Handle pending draw request confirmation
	useEffect(() => {
		if (!pendingDrawRequest) {
			return
		}

		const handleDrawRequestConfirm = async () => {
			const confirmed = await openConfirm({
				title: "popup.confirm.title",
				message: "room.messages.confirm-accept-draw",
				okLabel: "room.actions.accept-draw",
				cancelLabel: "room.actions.reject-draw"
			})

			let accepted = confirmed
			if (confirmed) {
				const token = getToken()
				if (!token) {
					accepted = false
				} else {
					const response = await drawGame(token, pendingDrawRequest.gameId)
					if (!response || !response.success) {
						accepted = false
						await openAlert({
							title: "popup.alert.title",
							message: response?.message ?? "draw-game.messages.internal-server-error"
						})
					} else {
						await openAlert({
							title: "popup.alert.title",
							message: "room.messages.draw-accepted",
							okLabel: "room.messages.back-to-room"
						})
						await submitBackToRoom(pendingDrawRequest.gameId)
						resetToWaitingRoom()
						await enforcePostGameBalance()
					}
				}
			}

			emitDrawResponse(
				pendingDrawRequest.roomId,
				pendingDrawRequest.gameId,
				accepted,
				pendingDrawRequest.requestUserId,
				currentUserId ?? undefined
			)
			setPendingDrawRequest(null)
		}

		handleDrawRequestConfirm()
	}, [
		currentUserId,
		pendingDrawRequest,
		drawGame,
		emitDrawResponse,
		submitBackToRoom
	])

	const handleStartGame = async () => {
		if (!(isHost && isWaiting && allPlayersReady)) {
			return
		}

		if (room && room.pve_mode) {
			dispatch(setPopup(PopupState.BOT_DIFFICULTY))
			return
		}

		await startGame()
	}

	const startGame = async (botDifficulty?: number) => {
		const token = getToken()
		if (!token || !Number.isInteger(roomId) || roomId <= 0) {
			return
		}

		const response = await startRoom(token, roomId, botDifficulty)
		if (!response) {
			return
		}
		if (!response.success) {
			await openAlert({
				title: "popup.alert.title",
				message: response.message
			})
			return
		}

		// The start sound + board init are driven by the `game-started` socket broadcast
		// (handled in the effect above), so all clients react uniformly - including the host.
		const nextStatus = Number(response.data?.room?.status) || 2
		if (response.data?.game?.id) {
			const newGame = {
				id: response.data.game.id,
				room_id: roomId,
				winner_id: null,
				status: response.data.game.status ?? 1,
				bot_difficulty: response.data.game.bot_difficulty ?? null
			}
			setGame(newGame)
		}
		setRoom(currentRoom => currentRoom
			? {
				...currentRoom,
				status: nextStatus
			}
			: currentRoom
		)
	}

	const handleChallenge = async () => {
		if (!isWaiting || isHost || isPlayer || !hasAvailableSeat || !canAffordBet) {
			return
		}

		const token = getToken()
		if (!token || !Number.isInteger(roomId) || roomId <= 0) {
			return
		}

		const response = await changeTeam(token, roomId, false)
		if (!response || !response.success) {
			await openAlert({
				title: "popup.alert.title",
				message: response?.message ?? "challenge.messages.internal-server-error"
			})
			return
		}

		setJoinedUsers(response.data as RoomUser[])
	}

	const handleLeaveSeat = async () => {
		if (!isWaiting || !isPlayer || isHost) {
			return
		}

		const token = getToken()
		if (!token || !Number.isInteger(roomId) || roomId <= 0) {
			return
		}

		const response = await changeTeam(token, roomId, true)
		if (!response || !response.success) {
			await openAlert({
				title: "popup.alert.title",
				message: response?.message ?? "challenge.messages.internal-server-error"
			})
			return
		}

		setJoinedUsers(response.data as RoomUser[])
	}

	const handleUndo = async () => {
		if (!room || !game) {
			return
		}

		if (!isPlaying || !room.pve_mode || !isPlayer || history.length <= 2) {
			return
		}

		try {
			const token = getToken()
			if (!token) {
				return
			}

			const response = await undoGame(token, game.id)
			if (!response || !response.success) {
				await openAlert({
					title: "popup.alert.title",
					message: response?.message ?? "undo.messages.internal-server-error"
				})
				return
			}

			// Refresh the countdown from the server's rewound clock (null = unclocked).
			setClock((response as { clock?: ClockSnapshot | null }).clock ?? null)

			// Remove the undone moves from history
			const movesDeleted = response.data?.movesDeleted ?? 1
			const newHistory = history.slice(0, history.length - movesDeleted)
			setHistory(newHistory)

			// Play sound
			playSound(import.meta.env.VITE_PUBLIC_DISTRIBUTION + MOVE_SOUND_URL)
		} catch (err) {
			logger.error("Undo error:", err)
			await openAlert({
				title: "popup.alert.title",
				message: "undo.messages.internal-server-error"
			})
		}
	}

	const handleDraw = async () => {
		if (!room || !game) {
			return
		}

		if (!isPlaying || !isPlayer) {
			return
		}

		const confirmed = await openConfirm({
			title: "popup.confirm.title",
			message: "room.messages.confirm-draw",
		})
		if (!confirmed) {
			return
		}

		// In PvE mode the opponent is a bot, so there is nobody to respond. Treat the
		// draw as automatically accepted and end the game directly.
		if (room.pve_mode) {
			const token = getToken()
			const response = await drawGame(token, game.id)
			if (!response || !response.success) {
				await openAlert({
					title: "popup.alert.title",
					message: response?.message ?? "draw-game.messages.internal-server-error"
				})
				return
			}

			await openAlert({
				title: "popup.alert.title",
				message: "room.messages.draw-accepted",
				okLabel: "room.messages.back-to-room"
			})
			await submitBackToRoom(game.id)
			resetToWaitingRoom()
			await enforcePostGameBalance()
			return
		}

		// Emit draw request to opponent
		emitDrawRequest(roomId, game.id, currentUserId ?? 0)
	}

	const handleSurrender = async () => {
		if (!room || !game) {
			return
		}

		if (!isPlaying || !isPlayer) {
			return
		}

		const confirmed = await openConfirm({
			title: "popup.confirm.title",
			message: "room.messages.confirm-surrender"
		})
		if (!confirmed) {
			return
		}

		const token = getToken()
		const response = await surrenderGame(token, game.id)
		if (!response || !response.success) {
			await openAlert({
				title: "popup.alert.title",
				message: response?.message
			})
			return
		}

		// Notify the opponent immediately after surrender succeeds
		emitSurrender(roomId, game.id, currentUserId ?? 0)
		const alertMessage = buildPostGameAlertMessage(false, POST_GAME_BACK_COUNTDOWN_SECONDS)

		await openAlert({
			title: "popup.alert.title",
			message: alertMessage,
			okLabel: "room.messages.back-to-room",
			countdownSeconds: POST_GAME_BACK_COUNTDOWN_SECONDS,
			countdownMessageBuilder: secondsLeft => buildPostGameAlertMessage(false, secondsLeft)
		})
		await submitBackToRoom(game.id)
		resetToWaitingRoom()
		await enforcePostGameBalance()
	}

	const handleBackToHome = async () => {
		const isInCurrentRoom = joinedUsers.some(user => user.id === currentUserId)
		if (history.length > 0 && !isInCurrentRoom) {
			return
		}

		const currentUser = joinedUsers.find(user => user.id === currentUserId)
		const isSpectator = currentUser?.team == null
		const isWaitingRoom = room?.status === 1
		if (!isSpectator && !isWaitingRoom) {
			const confirmed = await openConfirm({
				title: "popup.confirm.title",
				message: "room.messages.confirm-leave"
			})
			if (!confirmed) {
				return
			}
		}

		const token = getToken()
		if (!token || !Number.isInteger(roomId) || roomId <= 0) {
			navigate(LOGIN_PATH)
			return
		}

		await leaveRoom(token, roomId)
		navigate(LOGIN_PATH)
	}

	const handleRotateBoard = () => {
		setIsBoardRotated(prev => !prev)
	}

	const onPieceClick = (id: number) => () => {
		// Prevent piece selection while a move is pending
		if (isMovePending) return

		const clickedTeam = getTeamFromPieceChar(board[id]?.piece)
		const isAvailableMove = availableMoves.includes(id)

		if (!state.debugMode) {
			// Only seated players (myTeam set) may control pieces.
			// Spectators are locked out to prevent e.g. a 3rd user moving bot-opponent's pieces.
			if (!myTeam) return

			// And a seated player may only control their own pieces. Capturing via an
			// already-computed available move still works.
			if (clickedTeam && clickedTeam !== myTeam && !isAvailableMove) {
				return
			}
		}

		if (currentTurn !== clickedTeam && !isAvailableMove) {
			return
		}

		// Click on an available move
		if (isAvailableMove) {
			const gameStateClone = [...board]
			const oldIndex = selected!
			gameStateClone[oldIndex] = {
				id: oldIndex,
				piece: gameStateClone[oldIndex]!.piece,
				animateTo: id
			}

			setAvailableMoves([])
			setBoard(gameStateClone)
			return
		}
		const nextSelected = selected === id ? null : id
		const direction = getMoveDirection(room!.red_first, currentTurn)
		const nextAvailableMoves = getAvailableMoves(board, nextSelected, direction)
		setAvailableMoves(nextAvailableMoves)
		setPreviousMove(null)
		setSelected(nextSelected)
	}

	const onAnimateEnd = async () => {
		// Animation finished — commit remote move to history.
		// updateToState rebuilds from FEN; seamless since piece is already at its final position.
		if (pendingRemoteMove) {
			const moveRecord = pendingRemoteMove
			setPendingRemoteMove(null)
			const remoteWasCapture = remoteMoveRef.current?.fen === moveRecord.fen
				&& remoteMoveRef.current.isCapture
			if (remoteWasCapture) {
				playSound(import.meta.env.VITE_PUBLIC_DISTRIBUTION + CAPTURE_SOUND_URL)
			} else {
				playSound(import.meta.env.VITE_PUBLIC_DISTRIBUTION + MOVE_SOUND_URL)
			}
			setHistory(prev => prev.some(h => h._id === moveRecord._id)
				? prev
				: [...prev, moveRecord])
			return
		}

		// Prevent race condition: don't allow multiple simultaneous moves
		if (isMovePending) return

		if (selected === null) return

		const selectedId = selected
		const targetId = board[selectedId]!.animateTo
		if (targetId === undefined) return
		const oldTarget = board[targetId]
		const movedTeam = getTeamFromPieceChar(board[selectedId]!.piece)
		if (!movedTeam) {
			return
		}

		// Create new board state with the move applied
		const gameStateClone = applyMove(board, selectedId, targetId)

		// Check if this move puts the moving team's general in check
		const checkingPieces = findCheckingPieces(gameStateClone, movedTeam)
		const isMovedTeamGeneralInCheck = checkingPieces.length > 0

		if (isMovedTeamGeneralInCheck) {
			// Revert the move if it puts general in check - restore original board state
			const revertedBoard = [...board]
			revertedBoard[selectedId] = {
				id: selectedId,
				piece: revertedBoard[selectedId]!.piece,
			}

			await openAlert({
				title: "popup.alert.title",
				message: "game.general.in-check"
			})

			setSelected(null)
			setBoard(revertedBoard)
			return
		}

		// Move is valid, commit it
		const capturedPiecesClone = structuredClone(capturedPieces)
		let capturedPieceCharacter: PieceCharacter | null = null
		const oldTargetTeam = getTeamFromPieceChar(oldTarget?.piece)
		if (oldTarget?.piece && oldTargetTeam !== movedTeam) {
			capturedPieceCharacter = oldTarget.piece
			capturedPiecesClone[movedTeam].push(capturedPieceCharacter)
		}

		const enemyTeam = movedTeam === "red" ? "black" : "red"
		const enemyCheckingPieces = findCheckingPieces(gameStateClone, enemyTeam)
		const enemyInCheck = enemyCheckingPieces.length > 0
		const enemyLegalMovesCount = room
			? countLegalMoves(gameStateClone, enemyTeam, room.red_first)
			: 0
		const shouldVerifyState = enemyInCheck || enemyLegalMovesCount === 0
		if (capturedPieceCharacter) {
			playSound(import.meta.env.VITE_PUBLIC_DISTRIBUTION + CAPTURE_SOUND_URL)
		} else {
			playSound(import.meta.env.VITE_PUBLIC_DISTRIBUTION + MOVE_SOUND_URL)
		}
		setAvailableMoves([])
		setCapturedPieces(capturedPiecesClone)
		setBoard(gameStateClone)
		setSelected(null)
		// Mark from/to right away so local moves get the same previous-move highlight
		setPreviousMove({ from: selectedId, to: targetId })
		// After a legal move, if the opponent is in check, highlight the checking piece(s).
		setCheckingPieces(enemyCheckingPieces)
		setCurrentTurn(enemyTeam)

		if (room?.status === 2 && game) {
			const newFen = boardToFen(gameStateClone)
			const body: MovePieceRequest = {
				gameId: game.id,
				newFen,
				capturePiece: capturedPieceCharacter,
				team: movedTeam // active team (the one who just moved)
			}
			const token = getToken()

			// Emit move piece event to realtime listeners
			emitPlayerMove(body)

			try {
				setIsMovePending(true)
				const moveResponse = await movePiece(token, body) as APIResponse<HistoryData>
				if (moveResponse?.data?.clock) {
					setClock(moveResponse.data.clock)
				}

				if (shouldVerifyState) {
					const verify = await verifyGameState(token, {
						gameId: game.id,
						newFen,
						checkedTeam: enemyTeam
					}) as APIResponse<VerifyStateResponseData>

					if (!verify?.success) {
						logger.warn("[Room] verify-state failed", verify)
					} else if (verify.data?.gameEnded) {
						// Covers checkmate, stalemate and perpetual check (長將).
						await handleGameEnded({
							gameId: game.id,
							status: verify.data.status as "checkmate" | "stalemate" | "perpetual-check",
							winnerId: verify.data.winnerId
						})
					}
					// Perpetual-check warning is handled via the "perpetual-check-warning" socket event;
					// nothing more to do in the verify-state response.
				}
			} finally {
				setIsMovePending(false)
			}
		}

		if (getPieceFromCharacter(oldTarget?.piece) === "general") {
			await openAlert({
				message: "game.general.captured",
				title: translate("popup.alert.title")
			})
			await enforcePostGameBalance()
		}
	}

	const showHideSettings = (open: boolean) => () => setIsOpen(open)

	const handleSettingsSaved = (newName: string) => {
		setRoom(prev => prev ? { ...prev, name: newName } : prev)
	}

	const roomChatDialogContext: RoomChatDialogContextValue = {
		open: openRoomChat,
		roomId: room?.id || 0,
		roomName: room?.name || "room.chat.title",
		pveMode: room?.pve_mode || false,
		unreadCount: unreadChatCount,
		incomingMessage: incomingChatMessage,
		openChat: () => {
			setUnreadChatCount(0)
			setOpenRoomChat(true)
		},
		onClose: () => setOpenRoomChat(false)
	}

	const roomSettingsDialogValue: RoomSettingsDialogContextValue = {
		game,
		isOpen,
		isHost: room?.host_id != null && room.host_id === currentUserId,
		room,
		users: joinedUsers,

		closeSettings: showHideSettings(false),
		handleSettingsSaved,
		openSettings: showHideSettings(true)
	}

	// When the board view is flipped, keep each player's info card next to their
	// side of the board by swapping the top/bottom cards. UI-only, like the board flip.
	const displayTopUser = isBoardRotated ? bottomSideUser : topSideUser
	const displayBottomUser = isBoardRotated ? topSideUser : bottomSideUser

	// Locally-ticking countdown derived from the latest server snapshot.
	const clockDisplay = useGameClock(clock, isInGame)

	return {
		availableMoves,
		board,
		capturedPieces,
		checkingPieces,
		clockDisplay,
		currentTurn,
		displayTopUser,
		displayBottomUser,
		game,
		gameButtons,
		isBoardRotated,
		isInGame,
		isRoomLoading,
		myTeam,
		previousMove,
		roomChatDialogContext,
		roomSettingsDialogValue,
		selected,
		showConfetti,

		markerClass,
		onAnimateEnd,
		onPieceClick,
		startGame
	}
}

export default useRoomHook
