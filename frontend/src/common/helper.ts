import {
	BOARD_COLUMNS,
	BOARD_ROWS,
	LS_LANGUAGE,
	LS_TOKEN_KEY
} from "./constant"
import {
	getPieceFromCharacter,
	getTeamFromPieceChar,
	isInPalace,
	pushElephantIfValid,
	pushHorseTarget,
	scanLine,
	toIndex
} from "pages/Room/common"
import { fenPieceMap } from "pages/Room/constant"
import { FenMoveDiffResult } from "types/Common"
import {
	CellProps,
	NullableCellProps,
	PieceCharacter
} from "types/GameState"

const processSoldierMove = (
	state: any,
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

	const totalCells = BOARD_COLUMNS * BOARD_ROWS

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
			let push = scanLine(gameState, selectedId, -BOARD_COLUMNS, cur => cur >= 0, selectedTeam, true)
			moves.push(...push)
			push = scanLine(gameState, selectedId, BOARD_COLUMNS, cur => cur < totalCells, selectedTeam, true)
			moves.push(...push)
			push = scanLine(gameState, selectedId, -1, cur => cur >= 0 && ~~(cur / BOARD_COLUMNS) === cannonRow, selectedTeam, true)
			moves.push(...push)
			push = scanLine(gameState, selectedId, +1, cur => cur < totalCells && ~~(cur / BOARD_COLUMNS) === cannonRow, selectedTeam, true)
			moves.push(...push)
			break
		}

		case "chariot": {
			const chariotRow = ~~(selectedId / BOARD_COLUMNS)
			let push = scanLine(gameState, selectedId, -BOARD_COLUMNS, cur => cur >= 0, selectedTeam)
			moves.push(...push)
			push = scanLine(gameState, selectedId, BOARD_COLUMNS, cur => cur < totalCells, selectedTeam)
			moves.push(...push)
			push = scanLine(gameState, selectedId, -1, cur => cur >= 0 && ~~(cur / BOARD_COLUMNS) === chariotRow, selectedTeam)
			moves.push(...push)
			push = scanLine(gameState, selectedId, +1, cur => cur < totalCells && ~~(cur / BOARD_COLUMNS) === chariotRow, selectedTeam)
			moves.push(...push)
			break
		}

		case "horse":
			const selectedCol = selectedId % BOARD_COLUMNS
			const selectedRow = ~~(selectedId / BOARD_COLUMNS)

			let push = []
			let newIndex = -1
			// Up leg
			if (selectedRow > 0 && !gameState[toIndex(selectedRow - 1, selectedCol)]) {
				newIndex = (selectedRow - 2) * BOARD_COLUMNS + selectedCol - 1
				push = pushHorseTarget(gameState, selectedId, newIndex)
				moves.push(...push)
				newIndex = (selectedRow - 2) * BOARD_COLUMNS + selectedCol + 1
				push = pushHorseTarget(gameState, selectedId, newIndex)
				moves.push(...push)
			}

			// Down leg
			if (selectedRow < BOARD_ROWS - 1 && !gameState[toIndex(selectedRow + 1, selectedCol)]) {
				newIndex = (selectedRow + 2) * BOARD_COLUMNS + selectedCol - 1
				push = pushHorseTarget(gameState, selectedId, newIndex)
				moves.push(...push)
				newIndex = (selectedRow + 2) * BOARD_COLUMNS + selectedCol + 1
				push = pushHorseTarget(gameState, selectedId, newIndex)
				moves.push(...push)
			}

			// Left leg
			if (selectedCol > 0 && !gameState[toIndex(selectedRow, selectedCol - 1)]) {
				newIndex = (selectedRow - 1) * BOARD_COLUMNS + selectedCol - 2
				push = pushHorseTarget(gameState, selectedId, newIndex)
				moves.push(...push)
				newIndex = (selectedRow + 1) * BOARD_COLUMNS + selectedCol - 2
				push = pushHorseTarget(gameState, selectedId, newIndex)
				moves.push(...push)
			}

			// Right leg
			if (selectedCol < BOARD_COLUMNS - 1 && !gameState[toIndex(selectedRow, selectedCol + 1)]) {
				newIndex = (selectedRow - 1) * BOARD_COLUMNS + selectedCol + 2
				push = pushHorseTarget(gameState, selectedId, newIndex)
				moves.push(...push)
				newIndex = (selectedRow + 1) * BOARD_COLUMNS + selectedCol + 2
				push = pushHorseTarget(gameState, selectedId, newIndex)
				moves.push(...push)
			}

			break

		case "elephant":
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

		case "advisor":
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

		case "general":
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
					if ((targetCell.piece === "g" || targetCell.piece === "G") && targetTeam !== selectedTeam) {
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

	return moves
}

export function getLanguage() {
	const lang = localStorage.getItem(LS_LANGUAGE)
	return lang || "en"
}

export function getToken() {
	return localStorage.getItem(LS_TOKEN_KEY) || ""
}

function normalizeBase64Str(encoded: string) {
	const normalized = encoded.replace("_", "/").replace("-", "+")
	switch (normalized.length % 4) {
		case 2:
			return normalized + "=="
		case 3:
			return normalized + "="
		default:
			return normalized
	}
}

export function requireImage(url: string) {
	if (!url) {
		return "https://clf.hieunm.io.vn/public/notfound.png"
	}

	if (url.startsWith("https://") || url.startsWith("http://")) {
		return url
	}

	return `${import.meta.env.VITE_PUBLIC_DISTRIBUTION}${url}`
}

export function decodePayload(token: string | null) {
	if (!token) {
		return null
	}
	try {
		const payload = token.split(".")[1]
		const decode = atob(normalizeBase64Str(payload))
		return JSON.parse(decode)
	} catch (e) {
		return null
	}
}

export function getClaimsFromLocalStorage() {
	const token = getToken()
	return decodePayload(token)
}

function parseFenBoard(fen: string): Array<PieceCharacter | null> {
	const rows = fen.trim().split("/")
	if (rows.length !== BOARD_ROWS) {
		throw new Error(`Invalid FEN row count: expected ${BOARD_ROWS}, got ${rows.length}`)
	}

	const board: Array<PieceCharacter | null> = []
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
			board.push(token as PieceCharacter)
		}
	}

	const expectedSize = BOARD_COLUMNS * BOARD_ROWS
	if (board.length !== expectedSize) {
		throw new Error(`Invalid FEN board size: expected ${expectedSize}, got ${board.length}`)
	}

	return board
}

function toCellPropsFromToken(id: number, token: PieceCharacter): CellProps {
	return { id, piece: token }
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
	let movedToken: PieceCharacter | null = null
	let capturedToken: PieceCharacter | null = null

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
		movedCell: toCellPropsFromToken(newIndex, movedToken),
		capturedCell: capturedToken ? toCellPropsFromToken(newIndex, capturedToken) : null,
	}
}
