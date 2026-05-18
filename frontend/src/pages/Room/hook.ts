import { useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import classnames from "classnames"
import { BOARD_COLUMNS, LOGIN_PATH } from "common/constant"
import { pieceFenMap } from "./constant"
import { openAlert } from "components/AlertProvider"
import { openConfirm } from "components/ConfirmProvider"
import {
	decodePayload,
	getAvailableMoves,
	getToken,
	requireImage
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
import useAutoTitle from "hooks/useAutoTitle"
import useGameToolkit from "hooks/useGameToolkit"
import { PieceCharacter, Team } from "types/GameState"
import {
	HistoryData,
	MovePieceRequest,
	RoomInfo,
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
	const [room, setRoom] = useState<RoomInfo | null>(null)
	const [joinedUsers, setJoinedUsers] = useState<RoomUser[]>([])
	const [gameId, setGameId] = useState<string | null>(null)
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

	const playerIds = joinedUsers.slice(0, 2).map(user => Number(user.id))
	const firstJoinedUser = joinedUsers[0]
	const secondJoinedUser = joinedUsers[1]
	const isInCurrentRoom = currentUserId !== null
		&& joinedUsers.some(user => Number(user.id) === currentUserId)
	const isFirstJoinedPlayer = currentUserId !== null && playerIds[0] === currentUserId
	const isPlayer = currentUserId !== null && playerIds.includes(currentUserId)
	const user = joinedUsers.find(user => Number(user.id) === currentUserId)
	const isMyTurn = user && user.team && state.teamTurn === user.team

	const handleStartGame = async () => {
		if (!isFirstJoinedPlayer || joinedUsers.length < 2 || room?.status === 2) {
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

	const handleSurrender = async () => {
		if (!isPlayer || !gameId || (room && room.status !== 2)) {
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

	const leaveCurrentRoom = async () => {
		const token = getToken()
		if (!token || !Number.isInteger(roomId) || roomId <= 0) {
			navigate(LOGIN_PATH)
			return
		}

		await leaveRoom(token, roomId)
		navigate(LOGIN_PATH)
	}

	const handleBackToHome = async () => {
		if (!isInCurrentRoom) {
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

		await leaveCurrentRoom()
	}

	async function loadCurrentRoom() {
		const token = getToken()
		if (!token || !Number.isInteger(roomId) || roomId <= 0) {
			return
		}

		// First, get room info to fetch all joined users
		const roomInfoResponse = await getRoomById(token, roomId)
		if (!roomInfoResponse || !roomInfoResponse.success || !roomInfoResponse.data) {
			return
		}

		const roomUsers = (roomInfoResponse.data.users || []).map((user: any) => ({
			id: Number(user.id),
			display_name: String(user.display_name || ""),
			avatar_url: requireImage(user.avatar_url),
			team: user.team,
			joined_at: user.joined_at
		}))
		setRoom(roomInfoResponse.data.room)

		// Check if current user is already in the room
		const isUserAlreadyInRoom = roomUsers.some((u: any) => u.id === currentUserId)
		
		// Only call joinRoom if user is not already in the room
		if (!isUserAlreadyInRoom) {
			const joinRoomResponse = await joinRoom(token, roomId)
			// update joined users list with the response from joinRoom API
			// which contains the assigned team for the current user
			if (joinRoomResponse && joinRoomResponse.success && joinRoomResponse.data) {
				const updatedUsers = joinRoomResponse.data.map((user: any) => ({
					id: Number(user.id),
					display_name: String(user.display_name || ""),
					avatar_url: requireImage(user.avatar_url),
					team: user.team,
					joined_at: typeof user.joined_at === "string" ? user.joined_at : null
				}))
				setJoinedUsers(updatedUsers)
			}
		}
		else {
			setJoinedUsers(roomUsers)
		}

		// Load game history if room is in playing status
		if (roomInfoResponse.data.room.status === 2
			&& roomInfoResponse.data.game_id
		) {
			setGameId(roomInfoResponse.data.game_id)
			const history = await getGameHistory(token, roomInfoResponse.data.game_id ?? "")
			const records: HistoryData[] = history.data ?? []
			if (records.length > 0) {
				const capturedPieces = getCapturedPiecesFromHistory(records)
				const latest = records[records.length - 1]
				const fen = latest.fen as string
				const board = fenToBoard(fen)
				dispatch(setGameState({
					availableMoves: [],
					board,
					selected: null,
					teamTurn: latest.team as Team,
					capturedPieces
				}))
			}
		}
	}

	useEffect(() => {
		loadCurrentRoom()
	}, [])

	const markerClass = (col: number, row: number) => classnames("marker", {
		"left-edge": col === 0,
		"right-edge": col === BOARD_COLUMNS - 1,
		[`row-${row} col-${col}`]: true,
	})

	const onPieceClick = (id: number) => () => {
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
		const gameStateClone = [...state.board]
		const selectedId = state.selected!
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

		if (room?.status === 2 && gameId) {
			const newFen = boardToFen(gameStateClone)
			const body: MovePieceRequest = {
				gameId,
				newFen,
				capturePiece: capturedPieceCharacter,
				team: movedTeam // active team (the one who just moved)
			}
			const token = getToken()
			await movePiece(token, body)
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

	return {
		firstJoinedUser,
		isPlayer,
		isFirstJoinedPlayer,
		isInCurrentRoom,
		isMyTurn,
		joinedUsers,
		room,
		secondJoinedUser,
		state,

		handleBackToHome,
		handleStartGame,
		handleSurrender,
		markerClass,
		onAnimateEnd,
		onPieceClick
	}
}

export default useRoomHook
