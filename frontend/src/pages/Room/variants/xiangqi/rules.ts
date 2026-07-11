import classnames from "classnames"
import { BOARD_COLUMNS, BOARD_ROWS } from "common/constant"
import { FenMoveDiffResult } from "types/Common"
import { NullableCellProps, Piece, Team, XiangqiPieceCharacter } from "types/GameState"
import { fenPieceMap } from "./constants"
import { HistoryData, PieceSideUser, RoomUser } from "../../types"

// Xiangqi rules: board <-> FEN, move generation, check/checkmate, captured
// grouping, and view helpers. This is the single source of xiangqi logic
// (previously split across Room/common.ts and common/helper.ts), mirroring the
// variants/chess/rules.ts layout so engine/xiangqi.ts stays a thin adapter.

const totalCells = BOARD_COLUMNS * BOARD_ROWS

export function getTeamFromPieceChar(piece?: string | null): Team | null {
	if (!piece) {
		return null
	}

	return piece === piece.toLowerCase() ? "red" : "black"
}

export function getPieceFromCharacter(piece?: string | null): Piece | null {
	if (!piece) {
		return null
	}

	return fenPieceMap[piece as XiangqiPieceCharacter] ?? null
}

/**
 * Scans a single line from `from` in the given `step` direction.
 * In chariot mode: adds all empty squares and the first enemy piece.
 * In cannon mode: adds empty squares before the screen, then only an enemy piece after it.
 */
export function scanLine(
	gameState: NullableCellProps[],
	from: number,
	step: number,
	isValid: (current: number) => boolean,
	team: Team,
	cannon = false
): number[] {
	const result: number[] = []
	let cur = from + step
	let hasScreen = false
	while (isValid(cur)) {
		const cell = gameState[cur]
		const cellTeam = getTeamFromPieceChar(cell?.piece)
		if (!cannon) {
			if (!cell || !cell.piece) { result.push(cur); cur += step; continue }
			if (cellTeam !== team) result.push(cur)
			break
		} else {
			if (!hasScreen) {
				if (!cell || !cell.piece) { result.push(cur); cur += step; continue }
				hasScreen = true
			} else {
				if (!cell || !cell.piece) { cur += step; continue }
				if (cellTeam !== team) result.push(cur)
				break
			}
		}
		cur += step
	}
	return result
}

export function pushElephantIfValid(gameState: NullableCellProps[], fromId: number, toId: number) {
	if (toId < 0 || toId >= totalCells) {
		return []
	}

	const selectedPiece = gameState[fromId]!
	const selectedTeam = getTeamFromPieceChar(selectedPiece?.piece)
	const targetCell = gameState[toId]
	const targetTeam = getTeamFromPieceChar(targetCell?.piece)
	if (!selectedTeam) {
		return []
	}

	if (!targetCell || !targetCell.piece || targetTeam !== selectedTeam) {
		return [toId]
	}

	return []
}

export function toIndex(row: number, col: number) {
	return row * BOARD_COLUMNS + col
}

export function inBounds(row: number, col: number) {
	return row >= 0 && row < BOARD_ROWS && col >= 0 && col < BOARD_COLUMNS
}

export function isInPalace(from: number, target: number) {
	if (target < 0 || target >= totalCells) return false
	const col = target % BOARD_COLUMNS
	if (col < 3 || col > 5) return false // out of palace boundaries on the left or right side
	// return true if both from and target index are in the same top or bottom palace
	if (from / BOARD_COLUMNS <= 3) return target / BOARD_COLUMNS <= 3
	if (from / BOARD_COLUMNS >= 7) return target / BOARD_COLUMNS >= 7
	return false
}

export function pushHorseTarget(gameState: NullableCellProps[], selectedId: number, index: number) {
	if (index < 0 || index >= totalCells) {
		return []
	}

	const selectedPiece = gameState[selectedId]!
	const selectedTeam = getTeamFromPieceChar(selectedPiece?.piece)
	const targetCell = gameState[index]
	const targetTeam = getTeamFromPieceChar(targetCell?.piece)
	if (!selectedTeam) {
		return []
	}

	if (!targetCell || !targetCell.piece || targetTeam !== selectedTeam) {
		return [index]
	}
	return []
}

const processSoldierMove = (
	state: { gameState: NullableCellProps[]; selectedId: number; selectedPiece: NullableCellProps },
	forwardStep: number,
	isForwardValid: (id: number) => boolean,
	hasCrossedRiver: boolean
) => {
	const { gameState, selectedId, selectedPiece } = state
	const selectedTeam = getTeamFromPieceChar(selectedPiece?.piece)
	if (!selectedTeam) {
		return []
	}

	const soldierRow = ~~(selectedId / BOARD_COLUMNS)
	const moves: number[] = []
	// Move forward
	const forwardId = selectedId + forwardStep
	if (isForwardValid(forwardId)) {
		const cell = gameState[forwardId]
		const targetTeam = getTeamFromPieceChar(cell?.piece)
		if (!cell || !cell.piece || targetTeam !== selectedTeam) moves.push(forwardId)
	}
	// After crossing the river
	if (hasCrossedRiver) {
		// Move right
		const rightId = selectedId + 1
		if (rightId < BOARD_COLUMNS * BOARD_ROWS && ~~(rightId / BOARD_COLUMNS) === soldierRow) {
			const cell = gameState[rightId]
			const targetTeam = getTeamFromPieceChar(cell?.piece)
			if (!cell || !cell.piece || targetTeam !== selectedTeam) moves.push(rightId)
		}
		// Move left
		const leftId = selectedId - 1
		if (leftId >= 0 && ~~(leftId / BOARD_COLUMNS) === soldierRow) {
			const cell = gameState[leftId]
			const targetTeam = getTeamFromPieceChar(cell?.piece)
			if (!cell || !cell.piece || targetTeam !== selectedTeam) moves.push(leftId)
		}
	}

	return moves
}

export function getAvailableMoves(
	gameState: NullableCellProps[],
	selectedId: number | null,
	direction: 1 | -1
): number[] {
	if (selectedId === null) {
		return []
	}
	const moves: number[] = []
	const selectedPiece = gameState[selectedId]!
	const selectedPieceType = getPieceFromCharacter(selectedPiece.piece)
	const selectedTeam = getTeamFromPieceChar(selectedPiece.piece)
	if (!selectedPiece.piece || !selectedPieceType || !selectedTeam) {
		return []
	}

	/**
	 * Push the target index as available move if it is either empty or occupied by an enemy piece.
	 * @param targetIndex The index of the target cell.
	 */
	const pushIfEnemyOrEmpty = (targetIndex: number) => {
		if (targetIndex < 0 || targetIndex >= totalCells) {
			return
		}
		const targetCell = gameState[targetIndex]
		const targetTeam = getTeamFromPieceChar(targetCell?.piece)
		if (!targetCell || !targetCell.piece || targetTeam !== selectedTeam) {
			moves.push(targetIndex)
		}
	}

	switch (selectedPieceType) {
		case "soldier": {
			const state = { gameState, selectedId, selectedPiece }
			let push: number[] = []
			if (direction === 1) { // Move down
				push = processSoldierMove(
					state,
					BOARD_COLUMNS,
					id => id < BOARD_COLUMNS * BOARD_ROWS,
					selectedId >= 5 * BOARD_COLUMNS
				)
			}
			if (direction === -1) { // Move up
				push = processSoldierMove(
					state,
					-BOARD_COLUMNS,
					id => id >= 0,
					selectedId < 5 * BOARD_COLUMNS
				)
			}
			moves.push(...push)
			break
		}

		case "cannon": {
			const cannonRow = ~~(selectedId / BOARD_COLUMNS)
			let push = scanLine(
				gameState,
				selectedId,
				-BOARD_COLUMNS,
				cur => cur >= 0,
				selectedTeam,
				true
			)
			moves.push(...push)
			push = scanLine(
				gameState,
				selectedId,
				BOARD_COLUMNS,
				cur => cur < totalCells,
				selectedTeam,
				true
			)
			moves.push(...push)
			push = scanLine(
				gameState,
				selectedId,
				-1,
				cur => cur >= 0 && ~~(cur / BOARD_COLUMNS) === cannonRow,
				selectedTeam,
				true
			)
			moves.push(...push)
			push = scanLine(
				gameState,
				selectedId,
				+1,
				cur => cur < totalCells && ~~(cur / BOARD_COLUMNS) === cannonRow,
				selectedTeam,
				true
			)
			moves.push(...push)
			break
		}

		case "chariot": {
			const chariotRow = ~~(selectedId / BOARD_COLUMNS)
			let push = scanLine(
				gameState,
				selectedId,
				-BOARD_COLUMNS,
				cur => cur >= 0,
				selectedTeam
			)
			moves.push(...push)
			push = scanLine(
				gameState,
				selectedId,
				BOARD_COLUMNS,
				cur => cur < totalCells,
				selectedTeam
			)
			moves.push(...push)
			push = scanLine(
				gameState,
				selectedId,
				-1,
				cur => cur >= 0 && ~~(cur / BOARD_COLUMNS) === chariotRow,
				selectedTeam
			)
			moves.push(...push)
			push = scanLine(
				gameState,
				selectedId,
				+1,
				cur => cur < totalCells && ~~(cur / BOARD_COLUMNS) === chariotRow,
				selectedTeam
			)
			moves.push(...push)
			break
		}

		case "horse": {
			const selectedCol = selectedId % BOARD_COLUMNS
			const selectedRow = ~~(selectedId / BOARD_COLUMNS)

			let push: number[], newIndex: number
			// Up leg
			if (selectedRow > 0 && !gameState[toIndex(selectedRow - 1, selectedCol)]) {
				if (selectedRow >= 2 && selectedCol > 0) {
					newIndex = (selectedRow - 2) * BOARD_COLUMNS + selectedCol - 1
					push = pushHorseTarget(gameState, selectedId, newIndex)
					moves.push(...push)
				}
				if (selectedRow >= 2 && selectedCol < BOARD_COLUMNS - 1) {
					newIndex = (selectedRow - 2) * BOARD_COLUMNS + selectedCol + 1
					push = pushHorseTarget(gameState, selectedId, newIndex)
					moves.push(...push)
				}
			}

			// Down leg
			if (selectedRow < BOARD_ROWS - 1 && !gameState[toIndex(selectedRow + 1, selectedCol)]) {
				if (selectedRow < BOARD_ROWS - 2 && selectedCol > 0) {
					newIndex = (selectedRow + 2) * BOARD_COLUMNS + selectedCol - 1
					push = pushHorseTarget(gameState, selectedId, newIndex)
					moves.push(...push)
				}
				if (selectedRow < BOARD_ROWS - 2 && selectedCol < BOARD_COLUMNS - 1) {
					newIndex = (selectedRow + 2) * BOARD_COLUMNS + selectedCol + 1
					push = pushHorseTarget(gameState, selectedId, newIndex)
					moves.push(...push)
				}
			}

			// Left leg
			if (selectedCol > 0 && !gameState[toIndex(selectedRow, selectedCol - 1)]) {
				if (selectedCol >= 2 && selectedRow > 0) {
					newIndex = (selectedRow - 1) * BOARD_COLUMNS + selectedCol - 2
					push = pushHorseTarget(gameState, selectedId, newIndex)
					moves.push(...push)
				}
				if (selectedCol >= 2 && selectedRow < BOARD_ROWS - 1) {
					newIndex = (selectedRow + 1) * BOARD_COLUMNS + selectedCol - 2
					push = pushHorseTarget(gameState, selectedId, newIndex)
					moves.push(...push)
				}
			}

			// Right leg
			if (selectedCol < BOARD_COLUMNS - 1 && !gameState[toIndex(selectedRow, selectedCol + 1)]) {
				if (selectedCol < BOARD_COLUMNS - 2 && selectedRow > 0) {
					newIndex = (selectedRow - 1) * BOARD_COLUMNS + selectedCol + 2
					push = pushHorseTarget(gameState, selectedId, newIndex)
					moves.push(...push)
				}
				if (selectedCol < BOARD_COLUMNS - 2 && selectedRow < BOARD_ROWS - 1) {
					newIndex = (selectedRow + 1) * BOARD_COLUMNS + selectedCol + 2
					push = pushHorseTarget(gameState, selectedId, newIndex)
					moves.push(...push)
				}
			}

			break
		}

		case "elephant": {
			const selectedModForElephant = selectedId % BOARD_COLUMNS

			const upLeft = selectedId - BOARD_COLUMNS - 1
			if (selectedModForElephant >= 2
				&& selectedId >= 2 * BOARD_COLUMNS
				&& !gameState[upLeft]
			) {
				const push = pushElephantIfValid(gameState, selectedId, selectedId - 2 * BOARD_COLUMNS - 2)
				moves.push(...push)
			}

			const upRight = selectedId - BOARD_COLUMNS + 1
			if (selectedModForElephant <= BOARD_COLUMNS - 3
				&& selectedId >= 2 * BOARD_COLUMNS
				&& !gameState[upRight]
			) {
				const push = pushElephantIfValid(gameState, selectedId, selectedId - 2 * BOARD_COLUMNS + 2)
				moves.push(...push)
			}

			const downLeft = selectedId + BOARD_COLUMNS - 1
			if (selectedModForElephant >= 2
				&& selectedId < totalCells - 2 * BOARD_COLUMNS
				&& !gameState[downLeft]
			) {
				const push = pushElephantIfValid(gameState, selectedId, selectedId + 2 * BOARD_COLUMNS - 2)
				moves.push(...push)
			}

			const downRight = selectedId + BOARD_COLUMNS + 1
			if (selectedModForElephant <= BOARD_COLUMNS - 3
				&& selectedId < totalCells - 2 * BOARD_COLUMNS
				&& !gameState[downRight]
			) {
				const push = pushElephantIfValid(gameState, selectedId, selectedId + 2 * BOARD_COLUMNS + 2)
				moves.push(...push)
			}
			break
		}

		case "advisor": {
			const advisorMod = selectedId % BOARD_COLUMNS

			if (advisorMod > 0) {
				const upLeft = selectedId - BOARD_COLUMNS - 1
				if (isInPalace(selectedId, upLeft)) pushIfEnemyOrEmpty(upLeft)

				const downLeft = selectedId + BOARD_COLUMNS - 1
				if (isInPalace(selectedId, downLeft)) pushIfEnemyOrEmpty(downLeft)
			}

			if (advisorMod < BOARD_COLUMNS - 1) {
				const upRight = selectedId - BOARD_COLUMNS + 1
				if (isInPalace(selectedId, upRight)) pushIfEnemyOrEmpty(upRight)

				const downRight = selectedId + BOARD_COLUMNS + 1
				if (isInPalace(selectedId, downRight)) pushIfEnemyOrEmpty(downRight)
			}

			break
		}

		case "general": {
			const up = selectedId - BOARD_COLUMNS
			if (isInPalace(selectedId, up)) pushIfEnemyOrEmpty(up)

			const down = selectedId + BOARD_COLUMNS
			if (isInPalace(selectedId, down)) pushIfEnemyOrEmpty(down)

			const selectedModForGeneral = selectedId % BOARD_COLUMNS
			if (selectedModForGeneral > 0) {
				const left = selectedId - 1
				if (isInPalace(selectedId, left)) pushIfEnemyOrEmpty(left)
			}

			if (selectedModForGeneral < BOARD_COLUMNS - 1) {
				const right = selectedId + 1
				if (isInPalace(selectedId, right)) pushIfEnemyOrEmpty(right)
			}

			// Flying general: can capture enemy general if no piece blocks in the same file.
			const scanForEnemyGeneral = (step: number) => {
				let current = selectedId
				while (true) {
					const next = current + step
					if (next < 0 || next >= totalCells) break
					const targetCell = gameState[next]
					if (!targetCell) {
						current = next
						continue
					}

					const targetTeam = getTeamFromPieceChar(targetCell.piece)
					const isGeneral = targetCell.piece === "g" || targetCell.piece === "G"
					if (isGeneral && targetTeam !== selectedTeam) {
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
	// Sort moves in ascending order
	moves.sort((a, b) => a - b)

	return moves
}

export function getCapturedPiecesFromHistory(records: HistoryData[]) {
	const historyWithCaptured = records.filter(record => record.capture)
	if (historyWithCaptured.length > 0) {
		const captures = historyWithCaptured.map(m => m.capture as XiangqiPieceCharacter)
		const red = captures.filter(c => c && c === c.toUpperCase())
		const black = captures.filter(c => c && c === c.toLowerCase())

		return { red, black }
	}

	return {
		red: [] as XiangqiPieceCharacter[],
		black: [] as XiangqiPieceCharacter[]
	}
}

export function findCheckingPieces(board: NullableCellProps[], team: Team): number[] {
	const generalIndex = board.findIndex(cell => getPieceFromCharacter(cell?.piece) === "general"
		&& getTeamFromPieceChar(cell?.piece) === team)
	if (generalIndex < 0) return []

	const enemyTeam: Team = team === "red" ? "black" : "red"
	const checkers: number[] = []

	for (let id = 0; id < board.length; id += 1) {
		const cell = board[id]
		if (!cell || getTeamFromPieceChar(cell.piece) !== enemyTeam) continue

		const enemyDirection = enemyTeam === "red" ? -1 : 1
		const moves = getAvailableMoves(board, id, enemyDirection)
		if (moves.includes(generalIndex)) {
			checkers.push(id)
		}
	}

	return checkers
}

export function fenToBoard(fen: string): NullableCellProps[] {
	const rows = fen.trim().split("/")
	if (rows.length !== BOARD_ROWS) {
		throw new Error(`Invalid FEN row count: expected ${BOARD_ROWS}, got ${rows.length}`)
	}

	const board: NullableCellProps[] = []

	for (const rowText of rows) {
		for (const token of rowText) {
			if (token >= "1" && token <= "9") {
				const emptyCount = Number(token)
				for (let i = 0; i < emptyCount; i += 1) {
					board.push(null)
				}
				continue
			}

			if (!(token in fenPieceMap)) {
				throw new Error(`Invalid FEN piece token: '${token}'`)
			}

			const id = board.length
			board.push({
				id,
				piece: token as XiangqiPieceCharacter
			})
		}

		if (board.length % BOARD_COLUMNS !== 0) {
			throw new Error("Invalid FEN: a row does not have exactly 9 cells")
		}
	}

	if (board.length !== totalCells) {
		throw new Error(`Invalid FEN board size: expected ${totalCells}, got ${board.length}`)
	}

	return board
}

export function boardToFen(board: NullableCellProps[]): string {
	if (board.length !== totalCells) {
		throw new Error(`Invalid board size: expected ${totalCells}, got ${board.length}`)
	}

	const rows: string[] = []

	for (let row = 0; row < BOARD_ROWS; row += 1) {
		let rowFen = ""
		let emptyCount = 0

		for (let col = 0; col < BOARD_COLUMNS; col += 1) {
			const index = row * BOARD_COLUMNS + col
			const cell = board[index]

			if (!cell || !cell.piece) {
				emptyCount += 1
				continue
			}

			if (emptyCount > 0) {
				rowFen += String(emptyCount)
				emptyCount = 0
			}

			rowFen += cell.piece
		}

		if (emptyCount > 0) {
			rowFen += String(emptyCount)
		}

		rows.push(rowFen)
	}

	return rows.join("/")
}

/** CSS classes for an intersection marker at the given column/row. */
export function markerClass(col: number, row: number): string {
	return classnames("marker", {
		"left-edge": col === 0,
		"right-edge": col === BOARD_COLUMNS - 1,
		[`row-${row} col-${col}`]: true,
	})
}

/**
 * Forward direction (-1 up, 1 down) for the team whose turn it is, given which
 * side moves first. The first-moving team always sits at the bottom (moves up).
 */
export function getMoveDirection(redFirst: boolean, turn: Team): -1 | 1 {
	const bottomTeam: Team = redFirst ? "red" : "black"
	return turn === bottomTeam ? -1 : 1
}

/** Split the two players into top/bottom seats based on which side moves first. */
export function resolveSideUsers(joinedUsers: RoomUser[], redFirst: boolean): PieceSideUser {
	const bottomTeam: Team = redFirst ? "red" : "black"
	const bottomUser = joinedUsers.find(ju => ju.team === bottomTeam) ?? null
	const topUser = joinedUsers.find(ju => ju.team !== null && ju.team !== bottomTeam) ?? null
	return {
		top: topUser,
		bottom: bottomUser,
	}
}

/** Return a new board with the piece at `fromId` moved to `toId`. */
export function applyMove(board: NullableCellProps[], fromId: number, toId: number) {
	const next = [...board]
	const moving = next[fromId]!
	next[toId] = {
		id: toId,
		piece: moving.piece,
	}
	next[fromId] = null
	return next
}

export function countLegalMoves(board: NullableCellProps[], team: Team, redFirst: boolean): number {
	const direction = getMoveDirection(redFirst, team)
	let legalMovesCount = 0

	for (let id = 0; id < board.length; id += 1) {
		const cell = board[id]
		if (!cell || getTeamFromPieceChar(cell.piece) !== team) {
			continue
		}

		const candidateMoves = getAvailableMoves(board, id, direction)
		for (const toId of candidateMoves) {
			const nextBoard = applyMove(board, id, toId)
			const checkingPieces = findCheckingPieces(nextBoard, team)
			if (checkingPieces.length === 0) {
				legalMovesCount += 1
			}
		}
	}

	return legalMovesCount
}

function parseFenBoard(fen: string): Array<XiangqiPieceCharacter | null> {
	const rows = fen.trim().split("/")
	if (rows.length !== BOARD_ROWS) {
		throw new Error(`Invalid FEN row count: expected ${BOARD_ROWS}, got ${rows.length}`)
	}

	const board: Array<XiangqiPieceCharacter | null> = []
	for (const rowText of rows) {
		for (const token of rowText) {
			if (token >= "1" && token <= "9") {
				const emptyCount = Number(token)
				for (let i = 0; i < emptyCount; i += 1) {
					board.push(null)
				}
				continue
			}

			if (!(token in fenPieceMap)) {
				throw new Error(`Invalid FEN piece token: '${token}'`)
			}
			board.push(token as XiangqiPieceCharacter)
		}
	}

	const expectedSize = BOARD_COLUMNS * BOARD_ROWS
	if (board.length !== expectedSize) {
		throw new Error(`Invalid FEN board size: expected ${expectedSize}, got ${board.length}`)
	}

	return board
}

/**
 * Compare two FEN strings and infer the moved piece.
 * Returns null when the diff cannot be identified as one legal "from -> to" move.
 */
export function diffFenMove(oldFen: string, newFen: string): FenMoveDiffResult | null {
	const before = parseFenBoard(oldFen)
	const after = parseFenBoard(newFen)

	const diffIndexes: number[] = []
	for (let i = 0; i < before.length; i += 1) {
		if (before[i] !== after[i]) {
			diffIndexes.push(i)
		}
	}

	if (diffIndexes.length !== 2) {
		return null
	}

	const [indexA, indexB] = diffIndexes
	const beforeA = before[indexA]
	const afterA = after[indexA]
	const beforeB = before[indexB]
	const afterB = after[indexB]

	let oldIndex = -1
	let newIndex = -1
	let movedToken: XiangqiPieceCharacter | null = null
	let capturedToken: XiangqiPieceCharacter | null = null

	if (beforeA && !afterA && afterB === beforeA) {
		oldIndex = indexA
		newIndex = indexB
		movedToken = beforeA
		capturedToken = beforeB
	} else if (beforeB && !afterB && afterA === beforeB) {
		oldIndex = indexB
		newIndex = indexA
		movedToken = beforeB
		capturedToken = beforeA
	}

	if (oldIndex < 0 || newIndex < 0 || !movedToken) {
		return null
	}

	return {
		oldIndex,
		newIndex,
		movedCell: { id: newIndex, piece: movedToken },
		capturedCell: capturedToken ? { id: newIndex, piece: capturedToken } : null,
	}
}
