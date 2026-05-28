import { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { HOME_PATH, LOGIN_PATH } from "common/constant"
import {
	CAPTURE_SOUND_URL,
	EMPTY_BOARD_FEN,
	GAME_START_SOUND_URL,
	MOVE_SOUND_URL
} from "./constant"
import { openAlert } from "components/AlertProvider"
import { openConfirm } from "components/ConfirmProvider"
import {
	decodePayload,
	diffFenMove,
	getAvailableMoves,
	getToken
} from "common/helper"
import {
	applyMove,
	boardToFen,
	fenToBoard,
	getCapturedPiecesFromHistory,
	getMoveDirection,
	isGeneralInCheck,
	markerClass,
	playSound,
	resolveSideUsers,
	toCapturedFenChar
} from "./common"
import { translate } from "locales/translate"
import { useAPI } from "hooks/useAPI"
import { useSocket } from "hooks/useSocket"
import useAutoTitle from "hooks/useAutoTitle"
import { EmptyVoid, FenMoveDiffResult } from "types/Common"
import { CapturedPieces, NullableCellProps, PieceCharacter, Team } from "types/GameState"
import {
	DrawRequest,
	HistoryData,
	MovePieceRequest,
	PreviousMoveProps,
	RemoteMoveProps,
	RoomActionButton,
	RoomInfo,
	RoomInfoResponse,
	RoomUser
} from "./types"

const useRoomHook = () => {
	useAutoTitle("page.home.title")
	const {
		drawGame,
		getGameHistory,
		getRoomById,
		joinRoom,
		movePiece,
		startRoom,
		surrenderGame,
	} = useAPI()

	const {
		isConnected,
		joinRoom: socketJoinRoom,
		leaveRoom: socketLeaveRoom,
		onMovePiece,
		offMovePiece,
		emitPlayerMove,
		emitDrawRequest,
		emitDrawResponse,
		offDrawRequest,
		offDrawResponse,
		offGameStarted,
		offRoomUsersUpdated,
		onDrawRequest,
		onDrawResponse,
		onGameStarted,
		onRoomUsersUpdated,
	} = useSocket()

	const [room, setRoom] = useState<RoomInfo | null>(null)
	const [joinedUsers, setJoinedUsers] = useState<RoomUser[]>([])
	const [gameId, setGameId] = useState<string | null>(null)
	const [history, setHistory] = useState<HistoryData[]>([])

	const [actionMenuItems, setActionMenuItems] = useState<RoomActionButton[]>([])
	// Game board state (formerly the redux `game` slice). `currentTurn` doubles as
	// the old `teamTurn` field — both always held the same value.
	const [board, setBoard] = useState<NullableCellProps[]>([])
	const [selected, setSelected] = useState<number | null>(null)
	const [availableMoves, setAvailableMoves] = useState<number[]>([])
	const [previousMove, setPreviousMove] = useState<PreviousMoveProps | null>(null)
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
	const { id } = useParams()
	const roomId = Number(id)
	const navigate = useNavigate()

	const { leaveRoom } = useAPI()

	const currentUserId = useMemo(() => {
		const token = getToken()
		const payload = decodePayload(token)
		const id = Number(payload?.sub)
		return Number.isNaN(id) ? null : id
	}, [])

	// Team controlled by the logged-in player. Null for spectators
	const myTeam = useMemo<Team | null>(() => {
		const me = joinedUsers.find(user => user.id === currentUserId)
		return me?.team ?? null
	}, [joinedUsers, currentUserId])

	async function loadCurrentRoom() {
		const token = getToken()
		if (!token || !Number.isInteger(roomId) || roomId <= 0) {
			return
		}

		const roomInfoResponse: RoomInfoResponse = await getRoomById(token, roomId)
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
		setGameId(roomData.game_id)

		if (!roomData.game_id) {
			setHistory([])
			setAvailableMoves([])
			setBoard(fenToBoard(EMPTY_BOARD_FEN))
			setSelected(null)
			setCurrentTurn(roomData.room.red_first ? "red" : "black")
			setPreviousMove(null)
			setCapturedPieces({ red: [], black: [] })
		}
	}

	async function loadGameHistory() {
		if (!room || !gameId) {
			return
		}

		if (room.status === 2) {
			const token = getToken()
			const history = await getGameHistory(token, gameId)
			const userBlack = joinedUsers.find(user => user.team === "black")
			const userRed = joinedUsers.find(user => user.team === "red")
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

		const { top, bottom } = resolveSideUsers(joinedUsers, room.red_first)
		setTopSideUser(top)
		setBottomSideUser(bottom)
		if (history.length === 0) {
			setCurrentTurn(room && room.red_first ? "red" : "black")

			const menus: RoomActionButton[] = [
				{
					key: "start-room",
					icon: "fas fa-swords",
					label: translate("room.actions.start-room"),
					onClick: handleStartGame,
					visible: joinedUsers[0].id === currentUserId,
					enabled: joinedUsers.length >= 1 && room !== null && room.status !== 2
				},
				{
					key: "draw",
					icon: "far fa-handshake",
					label: translate("room.actions.draw"),
					onClick: handleDraw,
					visible: false,
					enabled: false
				},
				{
					key: "surrender",
					icon: "far fa-flag",
					label: translate("room.actions.surrender"),
					onClick: handleSurrender,
					visible: false,
					enabled: false
				},
				{
					key: "back-home",
					icon: "fas fa-left-from-bracket",
					label: translate("room.actions.back-home"),
					onClick: handleBackToHome,
					visible: true,
					enabled: true
				}
			]
			setActionMenuItems(menus)
			return
		}

		const nextCapturedPieces = getCapturedPiecesFromHistory(history)
		const latest = history[history.length - 1]
		const fen = latest.fen as string
		const nextBoard = fenToBoard(fen)

		const playerIds = joinedUsers.slice(0, 2).map(user => user.id)
		const currentUser = joinedUsers.find(user => user.id === currentUserId)
		const isInCurrentRoom = currentUser !== undefined
		const newIsPlayer = currentUserId !== null && playerIds.includes(currentUserId)
		setCurrentTurn(latest.team as Team)
		const isMyTurn = Boolean(currentUser?.team === latest.team)

		const canSurrender = isInCurrentRoom
			&& newIsPlayer
			&& room !== null
			&& room.status === 2
			&& Boolean(gameId)
			&& isMyTurn

		const menus: RoomActionButton[] = [
			{
				key: "start-room",
				icon: "fas fa-swords",
				label: translate("room.actions.start-room"),
				onClick: handleStartGame,
				visible: false,
				enabled: false
			},
			{
				key: "draw",
				icon: "far fa-handshake",
				label: translate("room.actions.draw"),
				onClick: handleDraw,
				visible: isInCurrentRoom && newIsPlayer && room !== null && room.status === 2,
				enabled: canSurrender
			},
			{
				key: "surrender",
				icon: "far fa-flag",
				label: translate("room.actions.surrender"),
				onClick: handleSurrender,
				visible: isInCurrentRoom && newIsPlayer && room !== null && room.status === 2,
				enabled: canSurrender
			},
			{
				key: "back-home",
				icon: "fas fa-left-from-bracket",
				label: translate("room.actions.back-home"),
				onClick: handleBackToHome,
				visible: isInCurrentRoom,
				enabled: isInCurrentRoom
			}
		]
		setActionMenuItems(menus)

		// Only highlight the previous move when it was made by the opponent of the
		// logged-in player. Prefer the diff captured at socket time (reliable in real
		// time); fall back to the history-based diff for the reload/spectator path.
		let nextPreviousMove: { from: number; to: number } | null = null
		if (remoteMoveRef.current && remoteMoveRef.current.fen === latest.fen) {
			nextPreviousMove = { from: remoteMoveRef.current.from, to: remoteMoveRef.current.to }
		}
		else if (latest.userId !== currentUserId && diff !== null) {
			nextPreviousMove = { from: diff.oldIndex, to: diff.newIndex }
		}

		// teamTurn already applied above via setCurrentTurn(latest.team)
		setAvailableMoves([])
		setBoard(nextBoard)
		setSelected(null)
		setPreviousMove(nextPreviousMove)
		setCapturedPieces(nextCapturedPieces)
	}

	useEffect(() => {
		loadCurrentRoom()
	}, [])

	useEffect(() => {
		loadGameHistory()
	}, [room, gameId])

	useEffect(() => {
		boardRef.current = board
	}, [board])

	useEffect(updateToState, [history, joinedUsers])

	// Socket.io: Update joined users in host view when another user joins the room
	useEffect(() => {
		if (!isConnected || !Number.isInteger(roomId) || roomId <= 0) {
			return
		}

		const handleRoomUsersUpdated = (data: { roomId: string | number; users: RoomUser[] }) => {
			if (!data || Number(data.roomId) !== roomId || !Array.isArray(data.users)) {
				return
			}

			setJoinedUsers(data.users)
		}

		onRoomUsersUpdated(handleRoomUsersUpdated)

		return () => {
			offRoomUsersUpdated(handleRoomUsersUpdated)
		}
	}, [isConnected, roomId, currentUserId, onRoomUsersUpdated, offRoomUsersUpdated])

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

	// Socket.io: Listen for draw request and response events
	useEffect(() => {
		if (!isConnected || !roomId) {
			return
		}

		const handleDrawRequest = (data: { roomId: string | number; gameId: string; requestUserId: number }) => {
			if (data.gameId !== gameId || data.requestUserId === currentUserId) {
				return
			}
			setPendingDrawRequest(data)
		}

		const handleDrawResponse = (data: {
			roomId: string | number
			gameId: string
			accepted: boolean
			requestUserId: number
			responseUserId?: number
		}) => {
			if (data.gameId !== gameId) {
				return
			}

			if (data.requestUserId !== currentUserId) {
				return
			}
			
			if (data.accepted) {
				openAlert({
					title: "popup.alert.title",
					message: "room.actions.draw-accepted"
				})
			} else {
				openAlert({
					title: "popup.alert.title",
					message: "room.actions.draw-rejected"
				})
			}
		}

		onDrawRequest(handleDrawRequest)
		onDrawResponse(handleDrawResponse)

		return () => {
			offDrawRequest(handleDrawRequest)
			offDrawResponse(handleDrawResponse)
		}
	}, [isConnected, roomId, gameId, currentUserId, onDrawRequest, offDrawRequest, onDrawResponse, offDrawResponse])

	// Socket.io: Play the gong and initialize the board when a game starts in this room.
	// Fires for everyone in the room (host, opponent, spectators) — the host plays it
	// here too, which is why handleStartGame no longer plays it directly.
	useEffect(() => {
		if (!isConnected || !Number.isInteger(roomId) || roomId <= 0) {
			return
		}

		const handleGameStarted = (data: { roomId: string | number; gameId?: string; status?: number }) => {
			if (!data || Number(data.roomId) !== roomId) {
				return
			}

			playSound(GAME_START_SOUND_URL)

			if (data.gameId) {
				setGameId(data.gameId)
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
				message: "room.actions.confirm-accept-draw",
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

		const token = getToken()
		if (!token || !Number.isInteger(roomId) || roomId <= 0) {
			return
		}

		// PvE room → play the bot at Master (5/5). UI for picking a tier comes later.
		// Tiers: 1 Beginner · 2 Amateur · 3 Intermediate · 4 Advanced · 5 Master.
		const botDifficulty = room && room.pve_mode ? 5 : undefined
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
			setGameId(response.data.game.id)
		}
		setRoom(currentRoom => currentRoom
			? {
				...currentRoom,
				status: nextStatus
			}
			: currentRoom
		)
	}

	const handleDraw = async () => {
		if (!gameId) {
			return
		}

		const currentUser = joinedUsers.find(user => user.id === currentUserId)
		const playerIds = joinedUsers.slice(0, 2).map(user => user.id)
		const isInCurrentRoom = currentUser !== undefined
		const isCurrentlyPlayer = currentUserId !== null && playerIds.includes(currentUserId)
		const latest = history.length > 0 ? history[history.length - 1] : null
		const isMyTurn = Boolean(currentUser?.team && latest && currentUser.team === latest.team)
		const canDraw = isInCurrentRoom
			&& isCurrentlyPlayer
			&& room?.status === 2
			&& isMyTurn
		if (!canDraw) {
			return
		}

		const confirmed = await openConfirm({
			title: "popup.confirm.title",
			message: "room.actions.confirm-draw"
		})
		if (!confirmed) {
			return
		}

		// Emit draw request to opponent
		emitDrawRequest(roomId, gameId, currentUserId)
	}

	const handleSurrender = async () => {
		if (!gameId) {
			return
		}

		const currentUser = joinedUsers.find(user => user.id === currentUserId)
		const playerIds = joinedUsers.slice(0, 2).map(user => user.id)
		const isInCurrentRoom = currentUser !== undefined
		const isCurrentlyPlayer = currentUserId !== null && playerIds.includes(currentUserId)
		const latest = history.length > 0 ? history[history.length - 1] : null
		const isMyTurn = Boolean(currentUser?.team && latest && currentUser.team === latest.team)
		const canSurrender = isInCurrentRoom
			&& isCurrentlyPlayer
			&& room?.status === 2
			&& isMyTurn
		if (!canSurrender) {
			return
		}

		const confirmed = await openConfirm({
			title: "popup.confirm.title",
			message: "room.actions.confirm-surrender"
		})
		if (!confirmed) {
			return
		}

		const token = getToken()
		const response = await surrenderGame(token, gameId)
		if (!response || !response.success) {
			await openAlert({
				title: "popup.alert.title",
				message: response?.message
			})
			return
		}
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
				message: "room.actions.confirm-leave"
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

		const clickedTeam = board[id]?.team
		const isAvailableMove = availableMoves.includes(id)

		// A player may only control pieces of their assigned team. Clicking an
		// opponent's piece does nothing (capturing it via an available move still works).
		if (myTeam && clickedTeam && clickedTeam !== myTeam && !isAvailableMove) {
			return
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
				team: gameStateClone[oldIndex]!.team,
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
				playSound(CAPTURE_SOUND_URL)
			} else {
				playSound(MOVE_SOUND_URL)
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
		const movedTeam = board[selectedId]!.team

		// Create new board state with the move applied
		const gameStateClone = applyMove(board, selectedId, targetId)

		// Check if this move puts the moving team's general in check
		const isMovedTeamGeneralInCheck = isGeneralInCheck(gameStateClone, movedTeam)

		if (isMovedTeamGeneralInCheck) {
			// Revert the move if it puts general in check - restore original board state
			const revertedBoard = [...board]
			revertedBoard[selectedId] = {
				id: selectedId,
				piece: revertedBoard[selectedId]!.piece,
				team: revertedBoard[selectedId]!.team,
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
		if (oldTarget && oldTarget.team !== movedTeam) {
			capturedPieceCharacter = toCapturedFenChar(oldTarget.piece, movedTeam)
			capturedPiecesClone[movedTeam].push(capturedPieceCharacter)
		}

		const enemyTeam = movedTeam === "red" ? "black" : "red"
		if (capturedPieceCharacter) {
			playSound(CAPTURE_SOUND_URL)
		} else {
			playSound(MOVE_SOUND_URL)
		}
		setAvailableMoves([])
		setCapturedPieces(capturedPiecesClone)
		setBoard(gameStateClone)
		setSelected(null)
		// The logged-in player's own move is never highlighted
		setPreviousMove(null)
		setCurrentTurn(enemyTeam)

		if (room?.status === 2 && gameId) {
			const newFen = boardToFen(gameStateClone)
			const body: MovePieceRequest = {
				gameId,
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

		if (oldTarget?.piece === "general") {
			openAlert({
				message: translate("game.general.captured"),
				title: translate("popup.alert.title")
			})
		}
	}

	const [menuAnchorEl, setMenuAnchorEl] = useState<HTMLElement | null>(null)
	const isActionMenuOpen = Boolean(menuAnchorEl)

	const openActionMenu = (event: React.MouseEvent<HTMLButtonElement>) => {
		setMenuAnchorEl(event.currentTarget)
	}

	const closeActionMenu = () => {
		setMenuAnchorEl(null)
	}

	const handleMenuItemClick = (callback: EmptyVoid) => () => {
		setMenuAnchorEl(null)
		callback()
	}

	return {
		actionMenuItems,
		availableMoves,
		board,
		bottomSideUser,
		capturedPieces,
		currentTurn,
		isActionMenuOpen,
		menuAnchorEl,
		myTeam,
		previousMove,
		selected,
		topSideUser,

		closeActionMenu,
		handleMenuItemClick,
		markerClass,
		onAnimateEnd,
		onPieceClick,
		openActionMenu
	}
}

export default useRoomHook
