import { fenToBoard } from "common/board-helper"
import { GameStateStatus, Team } from "types/game.type"

const BOARD_COLUMNS = 9
const BOARD_ROWS = 10

type BoardState = ReturnType<typeof fenToBoard>
type BoardCell = BoardState[number]

interface TeamStateEvaluation {
	inCheck: boolean
	legalMovesCount: number
	status: GameStateStatus
}

const toIndex = (row: number, col: number) => row * BOARD_COLUMNS + col

const getMoveDirection = (redFirst: boolean, team: Team): -1 | 1 => {
	const bottomTeam: Team = redFirst ? "red" : "black"
	return team === bottomTeam ? -1 : 1
}

const isInPalace = (from: number, target: number) => {
	if (target < 0 || target >= BOARD_COLUMNS * BOARD_ROWS) return false
	const col = target % BOARD_COLUMNS
	if (col < 3 || col > 5) return false
	if (from / BOARD_COLUMNS <= 3) return target / BOARD_COLUMNS <= 3
	if (from / BOARD_COLUMNS >= 7) return target / BOARD_COLUMNS >= 7
	return false
}

const scanLine = (
	board: BoardState,
	from: number,
	step: number,
	isValid: (current: number) => boolean,
	team: Team,
	cannon = false
) => {
	const result: number[] = []
	let cur = from + step
	let hasScreen = false

	while (isValid(cur)) {
		const cell = board[cur]
		const targetTeam = cell?.team

		if (!cannon) {
			if (!cell) {
				result.push(cur)
				cur += step
				continue
			}

			if (targetTeam !== team) result.push(cur)
			break
		}

		if (!hasScreen) {
			if (!cell) {
				result.push(cur)
				cur += step
				continue
			}
			hasScreen = true
		} else {
			if (!cell) {
				cur += step
				continue
			}

			if (targetTeam !== team) result.push(cur)
			break
		}

		cur += step
	}

	return result
}

const pushIfEnemyOrEmpty = (board: BoardState, team: Team, targetIndex: number, moves: number[]) => {
	if (targetIndex < 0 || targetIndex >= BOARD_COLUMNS * BOARD_ROWS) return
	const target = board[targetIndex]
	if (!target || target.team !== team) {
		moves.push(targetIndex)
	}
}

const getAvailableMoves = (board: BoardState, selectedId: number, direction: 1 | -1): number[] => {
	const selectedCell = board[selectedId]
	if (!selectedCell) return []

	const selectedPiece = selectedCell.piece
	const selectedTeam = selectedCell.team
	const totalCells = BOARD_COLUMNS * BOARD_ROWS
	const moves: number[] = []

	switch (selectedPiece) {
		case "soldier": {
			const forwardStep = direction * BOARD_COLUMNS
			const forwardId = selectedId + forwardStep
			if (forwardId >= 0 && forwardId < totalCells) {
				pushIfEnemyOrEmpty(board, selectedTeam, forwardId, moves)
			}

			const crossedRiver = direction === -1
				? selectedId < 5 * BOARD_COLUMNS
				: selectedId >= 5 * BOARD_COLUMNS

			if (crossedRiver) {
				const row = Math.floor(selectedId / BOARD_COLUMNS)
				const left = selectedId - 1
				const right = selectedId + 1

				if (left >= 0 && Math.floor(left / BOARD_COLUMNS) === row) {
					pushIfEnemyOrEmpty(board, selectedTeam, left, moves)
				}

				if (right < totalCells && Math.floor(right / BOARD_COLUMNS) === row) {
					pushIfEnemyOrEmpty(board, selectedTeam, right, moves)
				}
			}
			break
		}

		case "cannon": {
			const row = Math.floor(selectedId / BOARD_COLUMNS)
			moves.push(...scanLine(board, selectedId, -BOARD_COLUMNS, cur => cur >= 0, selectedTeam, true))
			moves.push(...scanLine(board, selectedId, BOARD_COLUMNS, cur => cur < totalCells, selectedTeam, true))
			moves.push(...scanLine(board, selectedId, -1, cur => cur >= 0 && Math.floor(cur / BOARD_COLUMNS) === row, selectedTeam, true))
			moves.push(...scanLine(board, selectedId, 1, cur => cur < totalCells && Math.floor(cur / BOARD_COLUMNS) === row, selectedTeam, true))
			break
		}

		case "chariot": {
			const row = Math.floor(selectedId / BOARD_COLUMNS)
			moves.push(...scanLine(board, selectedId, -BOARD_COLUMNS, cur => cur >= 0, selectedTeam))
			moves.push(...scanLine(board, selectedId, BOARD_COLUMNS, cur => cur < totalCells, selectedTeam))
			moves.push(...scanLine(board, selectedId, -1, cur => cur >= 0 && Math.floor(cur / BOARD_COLUMNS) === row, selectedTeam))
			moves.push(...scanLine(board, selectedId, 1, cur => cur < totalCells && Math.floor(cur / BOARD_COLUMNS) === row, selectedTeam))
			break
		}

		case "horse": {
			const col = selectedId % BOARD_COLUMNS
			const row = Math.floor(selectedId / BOARD_COLUMNS)

			const pushHorseTarget = (index: number) => {
				if (index < 0 || index >= totalCells) return
				const cell = board[index]
				if (!cell || cell.team !== selectedTeam) moves.push(index)
			}

			if (row > 0 && !board[toIndex(row - 1, col)]) {
				if (row >= 2 && col > 0) pushHorseTarget(toIndex(row - 2, col - 1))
				if (row >= 2 && col < BOARD_COLUMNS - 1) pushHorseTarget(toIndex(row - 2, col + 1))
			}

			if (row < BOARD_ROWS - 1 && !board[toIndex(row + 1, col)]) {
				if (row < BOARD_ROWS - 2 && col > 0) pushHorseTarget(toIndex(row + 2, col - 1))
				if (row < BOARD_ROWS - 2 && col < BOARD_COLUMNS - 1) pushHorseTarget(toIndex(row + 2, col + 1))
			}

			if (col > 0 && !board[toIndex(row, col - 1)]) {
				if (col >= 2 && row > 0) pushHorseTarget(toIndex(row - 1, col - 2))
				if (col >= 2 && row < BOARD_ROWS - 1) pushHorseTarget(toIndex(row + 1, col - 2))
			}

			if (col < BOARD_COLUMNS - 1 && !board[toIndex(row, col + 1)]) {
				if (col < BOARD_COLUMNS - 2 && row > 0) pushHorseTarget(toIndex(row - 1, col + 2))
				if (col < BOARD_COLUMNS - 2 && row < BOARD_ROWS - 1) pushHorseTarget(toIndex(row + 1, col + 2))
			}
			break
		}

		case "elephant": {
			const col = selectedId % BOARD_COLUMNS

			const pushElephantIfValid = (target: number) => {
				if (target < 0 || target >= totalCells) return
				const cell = board[target]
				if (!cell || cell.team !== selectedTeam) moves.push(target)
			}

			const upLeft = selectedId - BOARD_COLUMNS - 1
			if (col >= 2 && selectedId >= 2 * BOARD_COLUMNS && !board[upLeft]) {
				pushElephantIfValid(selectedId - 2 * BOARD_COLUMNS - 2)
			}

			const upRight = selectedId - BOARD_COLUMNS + 1
			if (col <= BOARD_COLUMNS - 3 && selectedId >= 2 * BOARD_COLUMNS && !board[upRight]) {
				pushElephantIfValid(selectedId - 2 * BOARD_COLUMNS + 2)
			}

			const downLeft = selectedId + BOARD_COLUMNS - 1
			if (col >= 2 && selectedId < totalCells - 2 * BOARD_COLUMNS && !board[downLeft]) {
				pushElephantIfValid(selectedId + 2 * BOARD_COLUMNS - 2)
			}

			const downRight = selectedId + BOARD_COLUMNS + 1
			if (col <= BOARD_COLUMNS - 3 && selectedId < totalCells - 2 * BOARD_COLUMNS && !board[downRight]) {
				pushElephantIfValid(selectedId + 2 * BOARD_COLUMNS + 2)
			}
			break
		}

		case "advisor": {
			const col = selectedId % BOARD_COLUMNS
			if (col > 0) {
				const upLeft = selectedId - BOARD_COLUMNS - 1
				const downLeft = selectedId + BOARD_COLUMNS - 1
				if (isInPalace(selectedId, upLeft)) pushIfEnemyOrEmpty(board, selectedTeam, upLeft, moves)
				if (isInPalace(selectedId, downLeft)) pushIfEnemyOrEmpty(board, selectedTeam, downLeft, moves)
			}

			if (col < BOARD_COLUMNS - 1) {
				const upRight = selectedId - BOARD_COLUMNS + 1
				const downRight = selectedId + BOARD_COLUMNS + 1
				if (isInPalace(selectedId, upRight)) pushIfEnemyOrEmpty(board, selectedTeam, upRight, moves)
				if (isInPalace(selectedId, downRight)) pushIfEnemyOrEmpty(board, selectedTeam, downRight, moves)
			}
			break
		}

		case "general": {
			const up = selectedId - BOARD_COLUMNS
			const down = selectedId + BOARD_COLUMNS
			if (isInPalace(selectedId, up)) pushIfEnemyOrEmpty(board, selectedTeam, up, moves)
			if (isInPalace(selectedId, down)) pushIfEnemyOrEmpty(board, selectedTeam, down, moves)

			const col = selectedId % BOARD_COLUMNS
			if (col > 0) {
				const left = selectedId - 1
				if (isInPalace(selectedId, left)) pushIfEnemyOrEmpty(board, selectedTeam, left, moves)
			}

			if (col < BOARD_COLUMNS - 1) {
				const right = selectedId + 1
				if (isInPalace(selectedId, right)) pushIfEnemyOrEmpty(board, selectedTeam, right, moves)
			}

			const scanForEnemyGeneral = (step: number) => {
				let current = selectedId
				while (true) {
					const next = current + step
					if (next < 0 || next >= totalCells) break
					const target = board[next]
					if (!target) {
						current = next
						continue
					}

					if (target.piece === "general" && target.team !== selectedTeam) {
						moves.push(next)
					}
					break
				}
			}

			scanForEnemyGeneral(-BOARD_COLUMNS)
			scanForEnemyGeneral(BOARD_COLUMNS)
			break
		}

		default:
			break
	}

	moves.sort((a, b) => a - b)
	return moves
}

const findCheckingPieces = (board: BoardState, team: Team, redFirst: boolean): number[] => {
	const generalIndex = board.findIndex(cell => cell?.piece === "general" && cell.team === team)
	if (generalIndex < 0) return []

	const enemyTeam: Team = team === "red" ? "black" : "red"
	const enemyDirection = getMoveDirection(redFirst, enemyTeam)
	const checkers: number[] = []

	for (let id = 0; id < board.length; id += 1) {
		const cell = board[id]
		if (!cell || cell.team !== enemyTeam) continue
		const moves = getAvailableMoves(board, id, enemyDirection)
		if (moves.includes(generalIndex)) checkers.push(id)
	}

	return checkers
}

const applyMove = (board: BoardState, fromId: number, toId: number): BoardState => {
	const next = [...board]
	const moving = next[fromId] as Exclude<BoardCell, null>
	next[toId] = { ...moving, id: toId }
	next[fromId] = null
	return next
}

const countLegalMoves = (board: BoardState, team: Team, redFirst: boolean): number => {
	const direction = getMoveDirection(redFirst, team)
	let legalMovesCount = 0

	for (let fromId = 0; fromId < board.length; fromId += 1) {
		const cell = board[fromId]
		if (!cell || cell.team !== team) continue

		const candidateMoves = getAvailableMoves(board, fromId, direction)
		for (const toId of candidateMoves) {
			const nextBoard = applyMove(board, fromId, toId)
			const stillChecked = findCheckingPieces(nextBoard, team, redFirst).length > 0
			if (!stillChecked) {
				legalMovesCount += 1
			}
		}
	}

	return legalMovesCount
}

export const evaluateTeamState = (fen: string, checkedTeam: Team, redFirst: boolean): TeamStateEvaluation => {
	const board = fenToBoard(fen)
	const inCheck = findCheckingPieces(board, checkedTeam, redFirst).length > 0
	const legalMovesCount = countLegalMoves(board, checkedTeam, redFirst)

	if (legalMovesCount === 0) {
		return {
			inCheck,
			legalMovesCount,
			status: inCheck ? "checkmate" : "stalemate"
		}
	}

	return {
		inCheck,
		legalMovesCount,
		status: inCheck ? "check" : "ongoing"
	}
}
