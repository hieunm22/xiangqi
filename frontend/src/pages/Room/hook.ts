import { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import classnames from "classnames"
import { BOARD_COLUMNS, HOME_PATH, LOGIN_PATH } from "common/constant"
import { EMPTY_BOARD_FEN, pieceFenMap } from "./constant"
import { openAlert } from "components/AlertProvider"
import { openConfirm } from "components/ConfirmProvider"
import {
	decodePayload,
	diffFenMove,
	getAvailableMoves,
	getToken
} from "common/helper"
import {
	boardToFen,
	fenToBoard,
	getCapturedPiecesFromHistory,
	initNewGame,
	isGeneralInCheck
} from "./common"
import { translate } from "locales/translate"
import { setGameState } from "toolkit/slice/game"
import { useAPI } from "hooks/useAPI"
import { useSocket } from "hooks/useSocket"
import useAutoTitle from "hooks/useAutoTitle"
import useGameToolkit from "hooks/useGameToolkit"
import { EmptyVoid } from "types/Common"
import { PieceCharacter, Team } from "types/GameState"
import {
	DrawRequest,
	HistoryData,
	MovePieceRequest,
	RoomActionButton,
	RoomInfo,
	RoomInfoResponse,
	RoomUser
} from "./types"

const useRoomHook = () => {
	useAutoTitle("page.home.title")
	const { state, dispatch } = useGameToolkit()
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
		onDrawRequest,
		onDrawResponse,
		onRoomUsersUpdated,
		offDrawRequest,
		offDrawResponse,
		offRoomUsersUpdated,
	} = useSocket()

	const [room, setRoom] = useState<RoomInfo | null>(null)
	const [joinedUsers, setJoinedUsers] = useState<RoomUser[]>([])
	const [gameId, setGameId] = useState<string | null>(null)
	const [history, setHistory] = useState<HistoryData[]>([])

	const [actionMenuItems, setActionMenuItems] = useState<RoomActionButton[]>([])
	const [currentTurn, setCurrentTurn] = useState<Team | null>(null)
	const [isMovePending, setIsMovePending] = useState(false)
	const [topSideUser, setTopSideUser] = useState<RoomUser | null>(null)
	const [bottomSideUser, setBottomSideUser] = useState<RoomUser | null>(null)
	// object history data set by socket event, used to trigger update new history data
	const [moveData, setMoveData] = useState<HistoryData | null>(null)
	const [pendingDrawRequest, setPendingDrawRequest] = useState<DrawRequest | null>(null)
	const boardRef = useRef(state.board)
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
			dispatch(setGameState({
				availableMoves: [],
				board: fenToBoard(EMPTY_BOARD_FEN),
				selected: null,
				teamTurn: roomData.room.red_first ? "red" : "black",
				capturedPieces: {
					red: [],
					black: []
				}
			}))
		}
	}

	async function loadGameHistory() {
		if (!room || !gameId) {
			return
		}

		if (room.status === 2) {
			const token = getToken()
			const history = await getGameHistory(token, gameId)
			setHistory(history.data ?? [])
		}
	}

	function updateToState() {
		if (joinedUsers.length === 0) {
			return
		}

		setTopSideUser(room && room.red_first ? joinedUsers[0] : joinedUsers[1])
		if (history.length === 0) {
			setCurrentTurn(room && room.red_first ? "red" : "black")
			if (joinedUsers.length > 1) {
				setBottomSideUser(room && room.red_first ? joinedUsers[1] : joinedUsers[0])
			}

			const menus: RoomActionButton[] = [
				{
					key: "start-room",
					icon: "fas fa-swords",
					label: translate("room.actions.start-room"),
					onClick: handleStartGame,
					visible: joinedUsers[0].id === currentUserId,
					enabled: joinedUsers.length >= 2 && room !== null && room.status !== 2
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

		const capturedPieces = getCapturedPiecesFromHistory(history)
		const latest = history[history.length - 1]
		const fen = latest.fen as string
		const board = fenToBoard(fen)

		const playerIds = joinedUsers.slice(0, 2).map(user => user.id)
		const currentUser = joinedUsers.find(user => user.id === currentUserId)
		const isInCurrentRoom = currentUser !== undefined
		const newIsPlayer = currentUserId !== null && playerIds.includes(currentUserId)
		setCurrentTurn(latest.team)
		const isMyTurn = Boolean(currentUser?.team === latest.team)

		setBottomSideUser(room && room.red_first ? joinedUsers[1] : joinedUsers[0])

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

		dispatch(setGameState({
			availableMoves: [],
			board,
			selected: null,
			teamTurn: latest.team as Team,
			capturedPieces
		}))
	}

	useEffect(() => {
		loadCurrentRoom()
	}, [])

	useEffect(() => {
		loadGameHistory()
	}, [room, gameId])

	useEffect(() => {
		boardRef.current = state.board
		if (moveData) {
			setMoveData(null)
			setHistory(prev => {
				if (prev.some(h => h._id === moveData._id)) {
					return prev
				}
				return [...prev, moveData]
			})
		}
	}, [state.board])

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
			if (!moveRecord?.fen) {
				return
			}

			const currentFen = boardToFen(boardRef.current)
			const newFen = moveRecord.fen
			const diff = diffFenMove(currentFen, newFen)
			const boardClone = boardRef.current.map(cell => {
				if (cell && diff && cell.id === diff.oldIndex) {
					const cellClone = { ...cell }
					cellClone.animateTo = diff.newIndex
					return cellClone
				}

				return cell
			})

			// Update board state first
			dispatch(setGameState({
				...state,
				board: boardClone
			}))

			// Then set move data to trigger useEffect and update history
			setMoveData(moveRecord)
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
		const canStart = joinedUsers.length >= 2 && room !== null && room.status !== 2
		if (!canStart) {
			return
		}

		const token = getToken()
		if (!token || !Number.isInteger(roomId) || roomId <= 0) {
			return
		}

		const response = await startRoom(token, roomId)
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

	const markerClass = (col: number, row: number) => classnames("marker", {
		"left-edge": col === 0,
		"right-edge": col === BOARD_COLUMNS - 1,
		[`row-${row} col-${col}`]: true,
	})

	const onPieceClick = (id: number) => () => {
		// Prevent piece selection while a move is pending
		if (isMovePending) return

		const currentTurn = state.teamTurn
		if (currentTurn !== state.board[id]?.team && !state.availableMoves.includes(id)) {
			return
		}

		// Click on an available move
		if (state.availableMoves.includes(id)) {
			const gameStateClone = [...state.board]
			const oldIndex = state.selected!
			gameStateClone[oldIndex] = {
				id: oldIndex,
				piece: gameStateClone[oldIndex]!.piece,
				team: gameStateClone[oldIndex]!.team,
				animateTo: id
			}

			dispatch(setGameState({
				...state,
				availableMoves: [],
				board: gameStateClone
			}))
			return
		}
		const selected = state.selected === id ? null : id
		let direction: -1 | 1 = -1
		if (room!.red_first) {
			direction = state.teamTurn === "red" ? -1 : 1
		}
		else {
			direction = state.teamTurn === "black" ? -1 : 1
		}
		const availableMoves = getAvailableMoves(state.board, selected, direction)
		dispatch(setGameState({
			...state,
			availableMoves,
			selected
		}))
	}

	const onAnimateEnd = async () => {
		// Prevent race condition: don't allow multiple simultaneous moves
		if (isMovePending) return

		if (state.selected === null) return

		const gameStateClone = [...state.board]
		const selectedId = state.selected
		const targetId = gameStateClone[selectedId]!.animateTo
		if (targetId === undefined) return
		const oldTarget = gameStateClone[targetId]
		const movedTeam = gameStateClone[selectedId]!.team

		// Create new board state with the move applied
		gameStateClone[targetId] = {
			id: targetId,
			piece: gameStateClone[selectedId]!.piece,
			team: movedTeam,
		}
		gameStateClone[selectedId] = null

		// Check if this move puts the moving team's general in check
		const isMovedTeamGeneralInCheck = isGeneralInCheck(gameStateClone, movedTeam)

		if (isMovedTeamGeneralInCheck) {
			// Revert the move if it puts general in check - restore original board state
			const revertedBoard = [...state.board]
			revertedBoard[selectedId] = {
				id: selectedId,
				piece: revertedBoard[selectedId]!.piece,
				team: revertedBoard[selectedId]!.team,
			}

			await openAlert({
				title: "popup.alert.title",
				message: "game.general.in-check"
			})

			dispatch(setGameState({
				...state,
				selected: null,
				board: revertedBoard
			}))
			return
		}

		// Move is valid, commit it
		const capturedPiecesClone = structuredClone(state.capturedPieces)
		let capturedPieceCharacter: PieceCharacter | null = null
		let capturedPieceLower: PieceCharacter | null = null
		if (oldTarget && oldTarget.team !== movedTeam) {
			capturedPieceLower = pieceFenMap[oldTarget.piece]
			capturedPieceCharacter = movedTeam === "red"
				? capturedPieceLower.toUpperCase() as PieceCharacter
				: capturedPieceLower.toLocaleLowerCase() as PieceCharacter
			capturedPiecesClone[movedTeam].push(capturedPieceCharacter as PieceCharacter)
		}

		const enemyTeam = movedTeam === "red" ? "black" : "red"
		dispatch(setGameState({
			...state,
			availableMoves: [],
			capturedPieces: capturedPiecesClone,
			board: gameStateClone,
			selected: null,
			teamTurn: enemyTeam
		}))
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
				const latest = await movePiece(token, body)
				setHistory(prev => [...prev, latest.data])
			} finally {
				setIsMovePending(false)
			}
		}

		if (oldTarget?.piece === "general") {
			openConfirm({
				message: translate("game.general.captured"),
				title: translate("popup.alert.title"),
				onOk: onOkConfirm
			})
		}
	}

	const onOkConfirm = () => {
		const init = initNewGame()
		dispatch(setGameState(init))
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
		bottomSideUser,
		currentTurn,
		isActionMenuOpen,
		isMovePending,
		menuAnchorEl,
		state,
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
