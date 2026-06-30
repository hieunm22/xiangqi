import { MouseEvent, useEffect, useMemo, useRef, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { HOME_PATH, LOGIN_PATH } from "common/constant"
import {
	CAPTURE_SOUND_URL,
	EMPTY_BOARD_FEN,
	GAME_START_SOUND_URL,
	MOVE_SOUND_URL
} from "./constant"
import { PopupState } from "common/enums"
import { openAlert } from "components/AlertProvider"
import { openConfirm } from "components/ConfirmProvider"
import { RoomChatMessage } from "components/ChatDialog/types"
import {
	diffFenMove,
	getAvailableMoves,
	getCurrentUserId,
	getToken
} from "common/helper"
import {
	applyMove,
	boardToFen,
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
import { translate } from "locales/translate"
import { setPopup } from "toolkit/slice/game"
import { APIResponse, EmptyVoid, FenMoveDiffResult } from "types/Common"
import { GameInfo } from "types/Entities"
import {
	CapturedPieces,
	NullableCellProps,
	PieceCharacter,
	Team
} from "types/GameState"
import {
	DrawRequest,
	GameMenuActionContextValue,
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
	StartGameBody
} from "./types"

const useRoomHook = () => {
	useAutoTitle("page.home.title")
	const { state, dispatch } = useToolkit()
	const {
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
		offGameStarted,
		offMovePiece,
		offRoomMessageSent,
		offRoomUsersUpdated,
		offSurrender,
		offUserKicked,
		onDrawRequest,
		onDrawResponse,
		onGameStarted,
		onMovePiece,
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
	const [openRoomChat, setOpenRoomChat] = useState(false)
	const [unreadChatCount, setUnreadChatCount] = useState(0)
	const [incomingChatMessage, setIncomingChatMessage] = useState<RoomChatMessage | null>(null)

	const [actionMenuItems, setActionMenuItems] = useState<RoomActionButton[]>([])
	// Game board state (formerly the redux `game` slice). `currentTurn` doubles as
	// the old `teamTurn` field — both always held the same value.
	const [board, setBoard] = useState<NullableCellProps[]>([])
	const [selected, setSelected] = useState<number | null>(null)
	const [availableMoves, setAvailableMoves] = useState<number[]>([])
	const [previousMove, setPreviousMove] = useState<MoveProps | null>(null)
	const [showConfetti, setShowConfetti] = useState(false)
	// Indices of enemy pieces currently giving check to myTeam's general. Highlighted
	// the same way as a previous-move cell so the player can see what's threatening them.
	const [checkingPieces, setCheckingPieces] = useState<number[]>([])
	const [capturedPieces, setCapturedPieces] = useState<CapturedPieces>({ red: [], black: [] })
	const [currentTurn, setCurrentTurn] = useState<Team>("red")
	const [isMovePending, setIsMovePending] = useState(false)
	const [topSideUser, setTopSideUser] = useState<RoomUser | null>(null)
	const [bottomSideUser, setBottomSideUser] = useState<RoomUser | null>(null)
	// Remote move waiting for its animation to finish before being committed to history
	const [pendingRemoteMove, setPendingRemoteMove] = useState<HistoryData | null>(null)
	const [pendingDrawRequest, setPendingDrawRequest] = useState<DrawRequest | null>(null)
	const boardRef = useRef(board)
	// The opponent's last move (from/to), keyed to the FEN it produces. Captured in
	// handleMovePiece where the diff is computed against the live board, because the
	// history-based diff in updateToState is unreliable in real time (local moves are
	// never appended to history, so consecutive history entries can span two moves).
	const remoteMoveRef = useRef<RemoteMoveProps | null>(null)
	// Mirror the chat-open state into a ref so the room-message-sent listener can
	// decide whether to bump the unread badge without re-subscribing on toggle.
	const openRoomChatRef = useRef(openRoomChat)
	openRoomChatRef.current = openRoomChat
	const { id } = useParams()
	const roomId = Number(id)
	const navigate = useNavigate()
	const currentUserId = getCurrentUserId()

	// Team controlled by the logged-in player. Null for spectators
	const myTeam = useMemo<Team | null>(() => {
		const me = joinedUsers.find(user => user.id === currentUserId)
		return me?.team ?? null
	}, [joinedUsers, currentUserId])

	// Reset client state to the post-game "waiting" view (room.status === 1, no
	// active game). Used after a draw is accepted or after a surrender — both end
	// the game on the backend but leave the room open for a new round, so the host
	// should see the start-game button again and in-game actions should disappear.
	const resetToWaitingRoom = () => {
		setRoom(prev => prev ? { ...prev, status: 1 } : prev)
		setGame(null)
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
		const token = getToken()
		if (!token || !Number.isInteger(roomId) || roomId <= 0) {
			return
		}

		const roomInfoResponse: APIResponse<RoomInfoData> = await getRoomById(token, roomId)
		if (!roomInfoResponse || !roomInfoResponse.success || !roomInfoResponse.data) {
			// navigate to home if room doesn't exist or failed to load
			navigate(HOME_PATH)
			return
		}
		const roomData = roomInfoResponse.data
		const roomUsers = (roomData.users || []) as RoomUser[]

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
			const isOpponentMove = latest.userId !== currentUserId
			if (isOpponentMove) {
				diff = diffFenMove(prevLatest.fen, latest.fen)
			}
		}

		const playerIds = joinedUsers.filter(u => u.team !== null).map(user => user.id)
		const currentUser = joinedUsers.find(user => user.id === currentUserId)

		const { top, bottom } = resolveSideUsers(joinedUsers, room.red_first)
		setTopSideUser(top)
		setBottomSideUser(bottom)

		const teams = joinedUsers.filter(u => u.team).map(u => u.team)
		const hasAvailableSeat = new Set(teams).size < 2

		const menus: RoomActionButton[] = [
			{
				key: "start-room",
				icon: "fas fa-swords",
				label: "room.actions.start-room",
				onClick: handleStartGame,
				visible: room.host_id === currentUserId && room.status === 1 && joinedUsers.length > 1,
				enabled: joinedUsers.length >= 1 && room !== null && room.status === 1
			},
			{
				key: "challenge",
				icon: "fas fa-hand-rock",
				label: "room.actions.challenge",
				onClick: handleChallenge,
				visible: currentUser?.team === null,
				enabled: room.status === 1 && currentUser?.team === null && hasAvailableSeat
			},
			{
				key: "leave-seat",
				icon: "fas fa-seat",
				label: "room.actions.leave-seat",
				onClick: handleLeaveSeat,
				visible: currentUser !== undefined && currentUser.team !== null && room.host_id !== currentUserId,
				enabled: room.status === 1 && currentUser !== undefined && currentUser.team !== null
			},
			{
				key: "undo",
				icon: "far fa-rotate-left",
				label: "room.actions.undo",
				onClick: handleUndo,
				visible: false,
				enabled: false
			},
			{
				key: "draw",
				icon: "far fa-handshake",
				label: "room.actions.draw",
				onClick: handleDraw,
				visible: false,
				enabled: false
			},
			{
				key: "surrender",
				icon: "far fa-flag",
				label: "room.actions.surrender",
				onClick: handleSurrender,
				visible: false,
				enabled: false
			},
			{
				key: "back-home",
				icon: "fas fa-left-from-bracket",
				label: "room.actions.back-home",
				onClick: handleBackToHome,
				visible: true,
				enabled: true
			}
		]

		if (history.length === 0) {
			setCurrentTurn(room && room.red_first ? "red" : "black")
			setActionMenuItems(menus)
			return
		}

		const nextCapturedPieces = getCapturedPiecesFromHistory(history)
		const latest = history[history.length - 1]
		const fen = latest.fen as string
		const nextBoard = fenToBoard(fen)
		const isInCurrentRoom = currentUser !== undefined
		const newIsPlayer = currentUserId !== null && playerIds.includes(currentUserId)
		setCurrentTurn(latest.team as Team)
		// const isMyTurn = Boolean(currentUser?.team === latest.team)

		const canSurrender = isInCurrentRoom
			&& newIsPlayer
			&& room !== null
			&& room.status === 2
			&& Boolean(game)

		menus[0].visible = false
		menus[0].enabled = false
		menus[1].enabled = false
		menus[1].enabled = false
		menus[2].enabled = false
		menus[2].enabled = false
		menus[3].visible = canSurrender
		menus[3].enabled = canSurrender && history.length > 2
		menus[4].visible = canSurrender
		menus[4].enabled = canSurrender
		menus[5].visible = canSurrender
		menus[5].enabled = canSurrender
		menus[6].visible = isInCurrentRoom
		menus[6].enabled = isInCurrentRoom
		setActionMenuItems(menus)

		// For spectators: highlight all moves
		// For players: only highlight opponent moves.
		// Prefer the diff captured at socket time (reliable in real time)
		// fall back to the history-based diff for the reload/spectator path.
		let nextPreviousMove: MoveProps | null = null
		const isSpectator = myTeam === null
		const isOpponentMove = latest.userId !== currentUserId

		if (isSpectator) {
			// Spectators see all moves
			if (remoteMoveRef.current && remoteMoveRef.current.fen === latest.fen) {
				nextPreviousMove = { from: remoteMoveRef.current.from, to: remoteMoveRef.current.to }
			}
			else if (diff !== null) {
				nextPreviousMove = { from: diff.oldIndex, to: diff.newIndex }
			}
		} else {
			// Players only see opponent moves
			if (remoteMoveRef.current && remoteMoveRef.current.fen === latest.fen && isOpponentMove) {
				nextPreviousMove = { from: remoteMoveRef.current.from, to: remoteMoveRef.current.to }
			}
			else if (isOpponentMove && diff !== null) {
				nextPreviousMove = { from: diff.oldIndex, to: diff.newIndex }
			}
		}

		// Highlight enemy pieces giving check, but only against the logged-in player's
		// general — spectators don't get the check highlight.
		const nextCheckingPieces = myTeam ? findCheckingPieces(nextBoard, myTeam) : []

		// teamTurn already applied above via setCurrentTurn(latest.team)
		setAvailableMoves([])
		setBoard(nextBoard)
		setSelected(null)
		setPreviousMove(nextPreviousMove)
		setCheckingPieces(nextCheckingPieces)
		// Merge new captures from history instead of replacing entirely, since local moves
		// are never added to history (socket skips them), so recalculating from history
		// alone would lose captures made by the current player
		setCapturedPieces(prev => ({
			red: nextCapturedPieces.red.length > prev.red.length ? nextCapturedPieces.red : prev.red,
			black: nextCapturedPieces.black.length > prev.black.length ? nextCapturedPieces.black : prev.black
		}))
	}

	useEffect(() => {
		loadCurrentRoom()
	}, [])

	useEffect(() => {
		loadGameHistory()
	}, [room?.status, game?.id])

	useEffect(() => {
		boardRef.current = board
	}, [board])

	useEffect(updateToState, [history, joinedUsers])

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

	// Socket.io: When the host kicks me out of this room, leave the socket channel,
	// notify me, and return to the home page. Other clients just see the seat list
	// refresh via `room-users-updated`.
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
				// console.log("[Room] Skipping piece move from self (userId:", moveRecord.userId, ")")
				return
			}

			if (!moveRecord?.fen) {
				return
			}

			const currentFen = boardToFen(boardRef.current)
			const newFen = moveRecord.fen
			const diff = diffFenMove(currentFen, newFen)
			// Remember this move so updateToState can highlight it once the FEN lands
			remoteMoveRef.current = diff !== null
				? { fen: newFen, from: diff.oldIndex, to: diff.newIndex, isCapture: diff.capturedCell !== null }
				: null
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

			// Defer history update until the move's CSS transition completes
			// (consumed in onAnimateEnd). Updating history right away would trigger
			// updateToState → dispatch fenToBoard(fen) on the next render, replacing
			// the animated piece (cell.id changes → React remounts) and killing the
			// transition before it can run.
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
			// Ignore our own message — the sender already appended it locally
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

		const handleDrawRequest = (data: { roomId: string | number; gameId: string; requestUserId: number }) => {
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
				resetToWaitingRoom()
				await openAlert({
					title: "popup.alert.title",
					message: "room.messages.draw-accepted"
				})
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
	}, [isConnected, roomId, game, currentUserId, onDrawRequest, offDrawRequest, onDrawResponse, offDrawResponse])

	// Socket.io: Listen for surrender event and show alert with confetti effect
	useEffect(() => {
		if (!isConnected || !roomId) {
			return
		}

		const handleSurrender = async (data: { roomId: string | number; gameId: string; surrenderingUserId: number }) => {
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

			await openAlert({
				title: "popup.alert.title",
				message: "room.messages.opponent-surrendered"
			})

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
	}, [isConnected, roomId, game, currentUserId, onSurrender, offSurrender])

	// Socket.io: Play the gong and initialize the board when a game starts in this room.
	// Fires for everyone in the room (host, opponent, spectators) — the host plays it
	// here too, which is why handleStartGame no longer plays it directly.
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
					status: data.status ?? 2,
					bot_difficulty: data.bot_difficulty ?? null
				}
				setGame(game)
			}
			setRoom(currentRoom => currentRoom
				? { ...currentRoom, status: data.status ?? 2 }
				: currentRoom
			)
		}

		onGameStarted(handleGameStarted)

		return () => {
			offGameStarted(handleGameStarted)
		}
	}, [isConnected, roomId, onGameStarted, offGameStarted])

	// Handle pending draw request confirmation
	useEffect(() => {
		if (!pendingDrawRequest) {
			return
		}

		const handleDrawRequestConfirm = async () => {
			const confirmed = await openConfirm({
				title: "popup.confirm.title",
				message: "room.messages.confirm-accept-draw",
				okLabel: "room.messages.accept-draw",
				cancelLabel: "room.messages.reject-draw"
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
	}, [pendingDrawRequest, emitDrawResponse, drawGame, currentUserId])

	const handleStartGame = async () => {
		const canStart = joinedUsers.length >= 1 && room !== null && room.status !== 2
		if (!canStart) {
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
		// (handled in the effect above), so all clients react uniformly — including the host.
		const nextStatus = Number(response.data?.room?.status) || 2
		if (response.data?.game?.id) {
			const newGame = {
				id: response.data.game.id,
				room_id: roomId,
				winner_id: null,
				status: response.data.game.status ?? nextStatus,
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

		const playerIds = joinedUsers.slice(0, 2).map(user => user.id)
		const currentUser = joinedUsers.find(user => user.id === currentUserId)
		const isInCurrentRoom = currentUser !== undefined
		const isCurrentlyPlayer = currentUserId !== null && playerIds.includes(currentUserId)
		const latest = history.length > 0 ? history[history.length - 1] : null
		// const isMyTurn = Boolean(currentUser?.team && latest && currentUser.team === latest.team)
		const canUndo = isInCurrentRoom
			&& isCurrentlyPlayer
			&& room.status === 2
			// latest move is not a restore point for current user
			&& (!latest?.undo || latest?.undo !== currentUserId)
			// && isMyTurn

		if (!canUndo) {
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

			// Remove the undone moves from history
			const movesDeleted = response.data?.movesDeleted ?? 1
			const newHistory = history.slice(0, history.length - movesDeleted)
			setHistory(newHistory)

			// Play sound
			playSound(import.meta.env.VITE_PUBLIC_DISTRIBUTION + MOVE_SOUND_URL)
		} catch (err) {
			console.error("Undo error:", err)
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

		const currentUser = joinedUsers.find(user => user.id === currentUserId)
		const playerIds = joinedUsers.slice(0, 2).map(user => user.id)
		const isInCurrentRoom = currentUser !== undefined
		const isCurrentlyPlayer = currentUserId !== null && playerIds.includes(currentUserId)
		const canDraw = isInCurrentRoom && isCurrentlyPlayer && room.status === 2
		if (!canDraw) {
			return
		}

		const confirmed = await openConfirm({
			title: "popup.confirm.title",
			message: "room.messages.confirm-draw"
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

			resetToWaitingRoom()

			await openAlert({
				title: "popup.alert.title",
				message: "room.messages.draw-accepted"
			})
			await enforcePostGameBalance()
			return
		}

		// Emit draw request to opponent
		emitDrawRequest(roomId, game.id, currentUserId)
	}

	const handleSurrender = async () => {
		if (!room || !game) {
			return
		}

		const currentUser = joinedUsers.find(user => user.id === currentUserId)
		const playerIds = joinedUsers.slice(0, 2).map(user => user.id)
		const isInCurrentRoom = currentUser !== undefined
		const isCurrentlyPlayer = currentUserId !== null && playerIds.includes(currentUserId)
		const canSurrender = isInCurrentRoom && isCurrentlyPlayer && room.status === 2
		if (!canSurrender) {
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

		// Emit surrender event to opponent before resetting local state, since
		// resetToWaitingRoom clears `game` which the emit reads from.
		emitSurrender(roomId, game.id, currentUserId ?? 0)
		resetToWaitingRoom()
		await enforcePostGameBalance()
	}

	const handleBackToHome = async () => {
		const isInCurrentRoom = joinedUsers.some(user => user.id === currentUserId)
		if (history.length > 0 && !isInCurrentRoom) {
			return
		}

		const currentUser = joinedUsers.find(user => user.id === currentUserId)
		if (currentUser?.team) {
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

	const onPieceClick = (id: number) => () => {
		// Prevent piece selection while a move is pending
		if (isMovePending) return

		const clickedTeam = getTeamFromPieceChar(board[id]?.piece)
		const isAvailableMove = availableMoves.includes(id)

		if (!state.debugMode) {
			// Only seated players may control pieces. Spectators (no assigned team) are
			// locked out entirely — otherwise a third user in a B-vs-bot room could move
			// B's pieces.
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
		// Remote move animation finished — now commit it to history. updateToState
		// will then rebuild the board from FEN; visually seamless because the piece
		// already animated to its final on-screen position.
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
		if (capturedPieceCharacter) {
			playSound(import.meta.env.VITE_PUBLIC_DISTRIBUTION + CAPTURE_SOUND_URL)
		} else {
			playSound(import.meta.env.VITE_PUBLIC_DISTRIBUTION + MOVE_SOUND_URL)
		}
		setAvailableMoves([])
		setCapturedPieces(capturedPiecesClone)
		setBoard(gameStateClone)
		setSelected(null)
		// The logged-in player's own move is never highlighted
		setPreviousMove(null)
		// A legal local move always resolves any check against the moving side.
		setCheckingPieces([])
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
				await movePiece(token, body)
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

	const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement | null>(null)
	const isActionMenuOpen = Boolean(menuAnchorEl)

	const openActionMenu = (e: MouseEvent<HTMLButtonElement>) => {
		setMenuAnchorEl(e.currentTarget)
	}

	const closeActionMenu = () => {
		setMenuAnchorEl(null)
	}

	const handleMenuItemClick = (callback: EmptyVoid) => () => {
		setMenuAnchorEl(null)
		callback()
	}

	const showHideSettings = (open: boolean) => () => setIsOpen(open)

	const handleSettingsSaved = (newName: string) => {
		setRoom(prev => prev ? { ...prev, name: newName } : prev)
	}


	const gameMenuActionContextValue: GameMenuActionContextValue = {
		actionMenuItems,
		isActionMenuOpen,
		menuAnchorEl,
		closeActionMenu,
		handleMenuItemClick,
		openActionMenu
	}

	const roomChatDialogContextValue: RoomChatDialogContextValue = {
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

	return {
		availableMoves,
		board,
		bottomSideUser,
		capturedPieces,
		checkingPieces,
		currentTurn,
		gameMenuActionContextValue,
		myTeam,
		previousMove,
		roomChatDialogContextValue,
		roomSettingsDialogValue,
		selected,
		showConfetti,
		topSideUser,

		markerClass,
		onAnimateEnd,
		onPieceClick,
		startGame
	}
}

export default useRoomHook
