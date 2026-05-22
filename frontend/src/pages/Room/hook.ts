import { useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import classnames from "classnames"
import { BOARD_COLUMNS, LOGIN_PATH } from "common/constant"
import { pieceFenMap } from "./constant"
import { openAlert } from "components/AlertProvider"
import { openConfirm } from "components/ConfirmProvider"
import {
	decodePayload,
	// diffFenMove,
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
		emitPlayerMove
	} = useSocket()

	const [room, setRoom] = useState<RoomInfo | null>(null)
	const [joinedUsers, setJoinedUsers] = useState<RoomUser[]>([])
	const [gameId, setGameId] = useState<string | null>(null)
	const [history, setHistory] = useState<HistoryData[]>([])

	const [actionMenuItems, setActionMenuItems] = useState<RoomActionButton[]>([])
	const [currentTurn, setCurrentTurn] = useState<Team | null>(null)
	const [isMovePending, setIsMovePending] = useState(false)
	const [isPlayer, setIsPlayer] = useState(false)
	const [firstJoinedUser, setFirstJoinedUser] = useState<RoomUser | null>(null)
	const [secondJoinedUser, setSecondJoinedUser] = useState<RoomUser | null>(null)
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

		if (history.length === 0) {
			setCurrentTurn(room && room.red_first ? "red" : "black")
			setFirstJoinedUser(room && room.red_first ? joinedUsers[0] : joinedUsers[1])
			if (joinedUsers.length > 1) {
				setSecondJoinedUser(room && room.red_first ? joinedUsers[1] : joinedUsers[0])
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
					visible: false,
					enabled: false
				},
				{
					key: "surrender",
					icon: "far fa-flag",
					label: translate("room.actions.surrender"),
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

		if (history.length > 0) {
			const capturedPieces = getCapturedPiecesFromHistory(history)
			const latest = history[history.length - 1]
			const fen = latest.fen as string
			const board = fenToBoard(fen)

			const playerIds = joinedUsers.slice(0, 2).map(user => user.id)
			const currentUser = joinedUsers.find(user => user.id === currentUserId)
			const isInCurrentRoom = currentUser !== undefined
			const newIsPlayer = currentUserId !== null && playerIds.includes(currentUserId)
			setIsPlayer(newIsPlayer)
			setCurrentTurn(latest.team)
			const isMyTurn = Boolean(currentUser && currentUser.team && currentUser.team === latest.team)

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
	}

	useEffect(() => {
		loadCurrentRoom()
	}, [])

	useEffect(() => {
		loadGameHistory()
	}, [room, gameId])

	useEffect(updateToState, [history, joinedUsers])

	// Socket.io: Join room and listen for piece-moved events
	useEffect(() => {
		if (!isConnected || !Number.isInteger(roomId) || roomId <= 0) {
			return
		}

		const handleMovePiece = (moveRecord: HistoryData) => {
			if (!moveRecord?.fen) {
				return
			}

			setHistory(prev => {
				if (prev.some(h => h._id === moveRecord._id)) {
					return prev
				}
				return [...prev, moveRecord]
			})
		}

		socketJoinRoom(roomId, currentUserId || undefined)
		onMovePiece(handleMovePiece)

		return () => {
			offMovePiece(handleMovePiece)
			socketLeaveRoom(roomId)
		}
	}, [isConnected, roomId, onMovePiece, offMovePiece, socketJoinRoom, socketLeaveRoom])

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

		// const token = getToken()
		// const response = await drawGame(token, gameId)
		// if (!response || !response.success) {
		// 	await openAlert({
		// 		title: "popup.alert.title",
		// 		message: response?.message
		// 	})
		// 	return
		// }
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

		if (isPlayer) {
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

		if (!state.selected) return

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
		currentTurn,
		firstJoinedUser,
		isActionMenuOpen,
		isMovePending,
		menuAnchorEl,
		secondJoinedUser,
		state,

		closeActionMenu,
		handleMenuItemClick,
		markerClass,
		onAnimateEnd,
		onPieceClick,
		openActionMenu
	}
}

export default useRoomHook
