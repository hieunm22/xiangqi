import { useEffect, useMemo, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import classnames from "classnames"
import {
	BOARD_COLUMNS,
	LS_BOARD,
	LS_CAPTURED_PIECES,
	LS_TURN
} from "common/constant"
import { openAlert } from "components/AlertProvider"
import { openConfirm } from "components/ConfirmProvider"
import {
	decodePayload,
  getAvailableMoves,
  getToken,
  initNewGame,
  isGeneralInCheck,
	requireImage
} from "common/helper"
import { translate } from "locales/translate"
import { setGameState } from "toolkit/slice/game"
import { useAPI } from "hooks/useAPI"
import useAutoTitle from "hooks/useAutoTitle"
import useGameToolkit from "hooks/useGameToolkit"
import { Team } from "types/GameState"
import { JoinedUser } from "./types"

const useRoomHook = () => {
	useAutoTitle("page.home.title")
	const { state, dispatch } = useGameToolkit()
	const { getRoomById, joinRoom } = useAPI()
	const getStoredTurn = () => (localStorage.getItem(LS_TURN) as Team) || "red"
	const [roomStatus, setRoomStatus] = useState(1)
	const [joinedUsers, setJoinedUsers] = useState<JoinedUser[]>([])
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
	const isInCurrentRoom = currentUserId !== null && joinedUsers.some(user => Number(user.id) === currentUserId)
	const isFirstJoinedPlayer = currentUserId !== null && playerIds[0] === currentUserId
	const isPlayer = currentUserId !== null && playerIds.includes(currentUserId)

	const handleStartGame = async () => {
		if (!isFirstJoinedPlayer) {
			return
		}

		// TODO: Call API to update room status from 1 -> 2
	}

	const handleSurrender = async () => {
		if (!isPlayer || roomStatus !== 2) {
			return
		}

		// TODO: Implement surrender API logic
	}

	const leaveCurrentRoom = async () => {
		const token = getToken()
		if (!token || !Number.isInteger(roomId) || roomId <= 0) {
			navigate("/")
			return
		}

		await leaveRoom(token, roomId)
		navigate("/")
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

	useEffect(() => {
		const loadCurrentRoom = async () => {
			const token = getToken()
			if (!token || !Number.isInteger(roomId) || roomId <= 0) {
				return
			}

			// First, get room info to fetch all joined users
			const roomInfoResponse = await getRoomById(token, roomId)
			if (!roomInfoResponse?.success || !roomInfoResponse?.room) {
				return
			}

			const roomUsers = (roomInfoResponse.room.users || []).map((user: any) => ({
				id: Number(user.id),
				display_name: String(user.display_name || ""),
				avatar_url: requireImage(user.avatar_url),
				team: user.team === "red" || user.team === "black" ? user.team : null
			}))

			setRoomStatus(Number(roomInfoResponse.room.status) || 1)
			setJoinedUsers(roomUsers)

			// Check if current user is already in the room
			const isUserAlreadyInRoom = roomUsers.some((u: any) => u.id === currentUserId)
			
			// Only call joinRoom if user is not already in the room
			if (!isUserAlreadyInRoom && currentUserId) {
				const joinRoomResponse = await joinRoom(token, roomId)
				// update joined users list with the response from joinRoom API, which contains the assigned team for the current user
				if (joinRoomResponse && joinRoomResponse.success && joinRoomResponse.data) {
					const updatedUsers = joinRoomResponse.data.map((user: any) => ({
						id: Number(user.id),
						display_name: String(user.display_name || ""),
						avatar_url: requireImage(user.avatar_url),
						team: user.team
					}))
					setJoinedUsers(updatedUsers)
				}
			}
		}

		loadCurrentRoom()
		// should merge 2 useEffects into 1
	}, [roomId])
	
	useEffect(() => {
		const currentTurn = getStoredTurn()
		const savedBoard = localStorage.getItem(LS_BOARD) || "[]"
		const capturedPieces = localStorage.getItem(LS_CAPTURED_PIECES) || "{\"red\":[],\"black\":[]}"
		dispatch(setGameState({
			availableMoves: [],
			board: JSON.parse(savedBoard!),
			selected: null,
			teamTurn: currentTurn,
			capturedPieces: JSON.parse(capturedPieces)
		}))
	}, [])

	useEffect(() => {
		if (getStoredTurn() !== state.teamTurn) {
			localStorage.setItem(LS_TURN, state.teamTurn)
		}
	}, [state.teamTurn])

	useEffect(() => {
		localStorage.setItem(LS_BOARD, JSON.stringify(state.board))
	}, [state.board])

	useEffect(() => {
		localStorage.setItem(LS_CAPTURED_PIECES, JSON.stringify(state.capturedPieces))
	}, [state.capturedPieces])
	
	const markerClass = (col: number, row: number) => classnames("marker", {
		"left-edge": col === 0,
		"right-edge": col === BOARD_COLUMNS - 1,
		[`row-${row} col-${col}`]: true,
	})

	const onPieceClick = (id: number) => () => {
		const currentTurn = state.teamTurn
		if (getStoredTurn() !== currentTurn) {
			localStorage.setItem(LS_TURN, currentTurn)
		}
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
		const availableMoves = getAvailableMoves(state.board, selected, currentTurn === "red" ? -1 : 1)
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
		if (oldTarget && oldTarget.team !== movedTeam) {
			capturedPiecesClone[movedTeam].push(oldTarget.piece)
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
		joinedUsers,
		roomStatus,
		secondJoinedUser,
		state,

		handleBackToHome,
		handleStartGame,
		handleSurrender,
		markerClass,
		onPieceClick,
		onAnimateEnd
	}
}

export default useRoomHook