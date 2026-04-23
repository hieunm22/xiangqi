import { BOARD_COLUMNS, BOARD_ROWS } from "./constant"
import type { CellProps, Piece, Team } from "types/GameState"

const initGameState: (Piece | null)[] = [
	"chariot", "horse", "elephant", "advisor", "general", "advisor", "elephant", "horse", "chariot",
	null, null, null, null, null, null, null, null, null,
	null, "cannon", null, null, null, null, null, "cannon", null,
	"soldier", null, "soldier", null, "soldier", null, "soldier", null, "soldier",
	null, null, null, null, null, null, null, null, null,
	null, null, null, null, null, null, null, null, null,
	"soldier", null, "soldier", null, "soldier", null, "soldier", null, "soldier",
	null, "cannon", null, null, null, null, null, "cannon", null,
	null, null, null, null, null, null, null, null, null,
	"chariot", "horse", "elephant", "advisor", "general", "advisor", "elephant", "horse", "chariot",
]

export function initNewGame() {
	const board = Array.from({ length: BOARD_COLUMNS * BOARD_ROWS }, (_, id): CellProps | null => {
		if (initGameState[id] === null) return null
		return {
			id,
			piece: initGameState[id],
			team: id < BOARD_COLUMNS * BOARD_ROWS / 2 ? "black" : "red" as Team
		}
	})

	return {
		board,
		selected: null,
		availableMoves: [],
		teamTurn: "red" as Team,
		capturedPieces: {
			red: [],
			black: []
		}
	}	
}

export function getAvailableMoves(
	gameState: (CellProps | null)[],
	selectedId: number | null,
	direction: 1 | -1
): number[] {
	if (selectedId === null) {
		return []
	}
	const moves: number[] = []
	const selectedPiece = gameState[selectedId]!
	const totalCells = BOARD_COLUMNS * BOARD_ROWS

	const scanLinearDirections = (
		onEncounter: (targetCell: CellProps | null, next: number, state: { foundScreen: boolean }) => "continue" | "break"
	) => {
		const scan = (
			step: number,
			isValidNext: (next: number, current: number) => boolean
		) => {
			let current = selectedId
			const state = { foundScreen: false }

			while (true) {
				const next = current + step
				if (!isValidNext(next, current)) break

				const targetCell = gameState[next]
				const action = onEncounter(targetCell, next, state)
				if (action === "break") break

				current = next
			}
		}

		scan(-BOARD_COLUMNS, next => next >= 0) // up
		scan(BOARD_COLUMNS, next => next < totalCells) // down
		scan(-1, (next, current) => next >= 0 && ~~(next / BOARD_COLUMNS) === ~~(current / BOARD_COLUMNS)) // left
		scan(1, (next, current) => next < totalCells && ~~(next / BOARD_COLUMNS) === ~~(current / BOARD_COLUMNS)) // right
	}

	const isInPalace = (index: number, team: Team) => {
		if (index < 0 || index >= totalCells) return false
		const col = index % BOARD_COLUMNS
		if (col < 3 || col > 5) return false
		if (team === "black") return index < 3 * BOARD_COLUMNS
		return index >= 7 * BOARD_COLUMNS
	}

	const pushIfEnemyOrEmpty = (targetIndex: number) => {
		if (targetIndex < 0 || targetIndex >= totalCells) return
		const targetCell = gameState[targetIndex]
		if (!targetCell || targetCell.team !== selectedPiece.team) {
			moves.push(targetIndex)
		}
	}

	const pushSideMoveIfSameRow = (selectedId: number, targetIndex: number) => {
		const selectedRowForSoldier = ~~(selectedId / BOARD_COLUMNS)
		if (~~(targetIndex / BOARD_COLUMNS) !== selectedRowForSoldier) return
		pushIfEnemyOrEmpty(targetIndex)
	}

	switch (selectedPiece.piece) {
		case "soldier":
			if (direction === 1) {
				pushIfEnemyOrEmpty(selectedId + BOARD_COLUMNS) // Move forward
				if (selectedId >= 5 * BOARD_COLUMNS) { // After crossing the river
					pushSideMoveIfSameRow(selectedId, selectedId + 1) // Move right
					pushSideMoveIfSameRow(selectedId, selectedId - 1) // Move left
				}
			}
			if (direction === -1) {
				pushIfEnemyOrEmpty(selectedId - BOARD_COLUMNS) // Move forward
				if (selectedId < 5 * BOARD_COLUMNS) { // After crossing the river
					pushSideMoveIfSameRow(selectedId, selectedId + 1) // Move right
					pushSideMoveIfSameRow(selectedId, selectedId - 1) // Move left
				}
			}
			break

		case "cannon":
			scanLinearDirections((targetCell, next, state) => {
				if (!state.foundScreen) {
					if (!targetCell) {
						moves.push(next)
						return "continue"
					}

					state.foundScreen = true
					return "continue"
				}

				if (!targetCell) {
					return "continue"
				}

				if (targetCell.team !== selectedPiece.team) {
					moves.push(next)
				}

				return "break"
			})
			break

		case "chariot":
			scanLinearDirections((targetCell, next) => {
				if (!targetCell) {
					moves.push(next)
					return "continue"
				}

				if (targetCell.team !== selectedPiece.team) {
					moves.push(next)
				}

				return "break"
			})
			break

		case "horse":
			const selectedCol = selectedId % BOARD_COLUMNS
			const selectedRow = ~~(selectedId / BOARD_COLUMNS)

			const toIndex = (row: number, col: number) => row * BOARD_COLUMNS + col
			const inBounds = (row: number, col: number) =>
				row >= 0 && row < BOARD_ROWS && col >= 0 && col < BOARD_COLUMNS

			const pushHorseTarget = (row: number, col: number) => {
				if (!inBounds(row, col)) return
				const targetIndex = toIndex(row, col)
				const targetCell = gameState[targetIndex]
				if (!targetCell || targetCell.team !== selectedPiece.team) {
					moves.push(targetIndex)
				}
			}

			// Up leg
			if (selectedRow > 0 && !gameState[toIndex(selectedRow - 1, selectedCol)]) {
				pushHorseTarget(selectedRow - 2, selectedCol - 1)
				pushHorseTarget(selectedRow - 2, selectedCol + 1)
			}

			// Down leg
			if (selectedRow < BOARD_ROWS - 1 && !gameState[toIndex(selectedRow + 1, selectedCol)]) {
				pushHorseTarget(selectedRow + 2, selectedCol - 1)
				pushHorseTarget(selectedRow + 2, selectedCol + 1)
			}

			// Left leg
			if (selectedCol > 0 && !gameState[toIndex(selectedRow, selectedCol - 1)]) {
				pushHorseTarget(selectedRow - 1, selectedCol - 2)
				pushHorseTarget(selectedRow + 1, selectedCol - 2)
			}

			// Right leg
			if (selectedCol < BOARD_COLUMNS - 1 && !gameState[toIndex(selectedRow, selectedCol + 1)]) {
				pushHorseTarget(selectedRow - 1, selectedCol + 2)
				pushHorseTarget(selectedRow + 1, selectedCol + 2)
			}

			break
		case "elephant":
			const riverBoundary = (BOARD_COLUMNS * BOARD_ROWS) / 2

			const pushElephantIfValid = (targetIndex: number) => {
				if (targetIndex < 0 || targetIndex >= totalCells) return
				if (selectedPiece.team === "black" && targetIndex >= riverBoundary) return
				if (selectedPiece.team === "red" && targetIndex < riverBoundary) return

				const targetCell = gameState[targetIndex]
				if (!targetCell || targetCell.team !== selectedPiece.team) {
					moves.push(targetIndex)
				}
			}

			const selectedModForElephant = selectedId % BOARD_COLUMNS

			const upLeftIndex = selectedId - BOARD_COLUMNS - 1
			if (selectedModForElephant >= 2 && selectedId >= 2 * BOARD_COLUMNS && !gameState[upLeftIndex]) {
				pushElephantIfValid(selectedId - 2 * BOARD_COLUMNS - 2)
			}

			const upRightIndex = selectedId - BOARD_COLUMNS + 1
			if (selectedModForElephant <= BOARD_COLUMNS - 3 && selectedId >= 2 * BOARD_COLUMNS && !gameState[upRightIndex]) {
				pushElephantIfValid(selectedId - 2 * BOARD_COLUMNS + 2)
			}

			const downLeftIndex = selectedId + BOARD_COLUMNS - 1
			if (selectedModForElephant >= 2 && selectedId < totalCells - 2 * BOARD_COLUMNS && !gameState[downLeftIndex]) {
				pushElephantIfValid(selectedId + 2 * BOARD_COLUMNS - 2)
			}

			const downRightIndex = selectedId + BOARD_COLUMNS + 1
			if (selectedModForElephant <= BOARD_COLUMNS - 3 && selectedId < totalCells - 2 * BOARD_COLUMNS && !gameState[downRightIndex]) {
				pushElephantIfValid(selectedId + 2 * BOARD_COLUMNS + 2)
			}
			break

		case "advisor":
			const advisorMod = selectedId % BOARD_COLUMNS

			if (advisorMod > 0) {
				const upLeft = selectedId - BOARD_COLUMNS - 1
				if (isInPalace(upLeft, selectedPiece.team)) pushIfEnemyOrEmpty(upLeft)

				const downLeft = selectedId + BOARD_COLUMNS - 1
				if (isInPalace(downLeft, selectedPiece.team)) pushIfEnemyOrEmpty(downLeft)
			}

			if (advisorMod < BOARD_COLUMNS - 1) {
				const upRight = selectedId - BOARD_COLUMNS + 1
				if (isInPalace(upRight, selectedPiece.team)) pushIfEnemyOrEmpty(upRight)

				const downRight = selectedId + BOARD_COLUMNS + 1
				if (isInPalace(downRight, selectedPiece.team)) pushIfEnemyOrEmpty(downRight)
			}

			break
		case "general":
			const up = selectedId - BOARD_COLUMNS
			if (isInPalace(up, selectedPiece.team)) pushIfEnemyOrEmpty(up)

			const down = selectedId + BOARD_COLUMNS
			if (isInPalace(down, selectedPiece.team)) pushIfEnemyOrEmpty(down)

			const selectedModForGeneral = selectedId % BOARD_COLUMNS
			if (selectedModForGeneral > 0) {
				const left = selectedId - 1
				if (isInPalace(left, selectedPiece.team)) pushIfEnemyOrEmpty(left)
			}

			if (selectedModForGeneral < BOARD_COLUMNS - 1) {
				const right = selectedId + 1
				if (isInPalace(right, selectedPiece.team)) pushIfEnemyOrEmpty(right)
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

					if (targetCell.piece === "general" && targetCell.team !== selectedPiece.team) {
						moves.push(next)
					}
					break
				}
			}

			scanForEnemyGeneral(-BOARD_COLUMNS)
			scanForEnemyGeneral(BOARD_COLUMNS)

			break

		default:
			break
	}
	// Sort moves in ascending order
	moves.sort((a, b) => a - b)

	// Filter out moves that are out of bounds
	return moves.filter(f => f >= 0 && f < BOARD_COLUMNS * BOARD_ROWS)
}

export function isGeneralInCheck(
	board: (CellProps | null)[],
	team: Team
): boolean {
	const generalIndex = board.findIndex(cell => cell?.piece === "general" && cell.team === team)
	if (generalIndex < 0) return false

	const enemyTeam: Team = team === "red" ? "black" : "red"

	for (let id = 0; id < board.length; id += 1) {
		const cell = board[id]
		if (!cell || cell.team !== enemyTeam) continue

		const enemyDirection = cell.team === "red" ? -1 : 1
		const moves = getAvailableMoves(board, id, enemyDirection)
		if (moves.includes(generalIndex)) {
			return true
		}
	}

	return false
}
