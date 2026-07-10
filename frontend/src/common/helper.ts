import {
	BOARD_COLUMNS,
	BOARD_ROWS,
	LS_LANGUAGE,
	LS_TOKEN_KEY
} from "./constant"
import { fenPieceMap } from "pages/Room/constant"
import { CustomConsole } from "./logger"
import { translate } from "locales/translate"
import {
	getPieceFromCharacter,
	getTeamFromPieceChar,
	isInPalace,
	pushElephantIfValid,
	pushHorseTarget,
	scanLine,
	toIndex
} from "pages/Room/common"
import { FenMoveDiffResult } from "types/Common"
import { NullableCellProps, PieceCharacter } from "types/GameState"

String.prototype.format = function(...args: any) {
	return this.toString().replace(/{(\d+)}/g, (match, index) => {
		return typeof args[index] !== "undefined" ? args[index] : match
	})
}

export const logger = new CustomConsole()

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

			let push, newIndex
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

export function formatNumber(num?: number, locale: string = "en") {
	if (num === undefined) {
		return "-"
	}
	return num.toLocaleString(locale)
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
	} catch {
		return null
	}
}

export function getClaimsFromLocalStorage() {
	const token = getToken()
	return decodePayload(token)
}

export function getCurrentUserId(): number | null {
	const claims = getClaimsFromLocalStorage()
	if (!claims || !claims.sub) {
		return null
	}
	const id = Number(claims.sub)
	return Number.isNaN(id) ? null : id
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
		movedCell: { id: newIndex, piece: movedToken },
		capturedCell: capturedToken ? { id: newIndex, piece: capturedToken } : null,
	}
}

/**
 * Convert a timestamp (in seconds) to a date/time string array
 */
export function formatTimestampToDateTimeArray(timestamp: string, language: string) {
	const date = new Date(timestamp)
	const now = new Date()

	// Get dates without time for comparison
	const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate())
	const todayOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate())
	const yesterdayOnly = new Date(todayOnly)
	yesterdayOnly.setDate(yesterdayOnly.getDate() - 1)

	// Calculate difference in days
	const daysDiff = Math.floor((todayOnly.getTime() - dateOnly.getTime()) / (1000 * 60 * 60 * 24))

	// Format time as H:mm
	const hours = date.getHours()
	const minutes = date.getMinutes().toString().padStart(2, '0')
	const timeString = `${hours}:${minutes}`

	// Determine date string
	let dateString: string | null = null

	if (daysDiff === 0) {
		// Same day - return null
		dateString = null
	} else if (daysDiff === 1) {
		// Yesterday
		dateString = translate('common.date.yesterday')
	} else if (daysDiff >= 2 && daysDiff < 7) {
		// 2-7 days ago - show day of week
		const dayOfWeekKey = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][date.getDay()]
		dateString = translate(`common.date.${dayOfWeekKey}`)
	} else if (daysDiff >= 7) {
		// >= 7 days ago
		if (date.getFullYear() === now.getFullYear()) {
			// Same year - show dd/MM or MM/dd based on language
			if (language === 'vi') {
				// Vietnamese: dd/MM
				const day = date.getDate().toString().padStart(2, '0')
				const month = (date.getMonth() + 1).toString().padStart(2, '0')
				dateString = `${day}/${month}`
			} else {
				// English: MM/dd
				const month = (date.getMonth() + 1).toString().padStart(2, '0')
				const day = date.getDate().toString().padStart(2, '0')
				dateString = `${month}/${day}`
			}
		} else {
			// Different year - show full date dd/MM/yyyy or MM/dd/yyyy
			if (language === 'vi') {
				// Vietnamese: dd/MM/yyyy
				const day = date.getDate().toString().padStart(2, '0')
				const month = (date.getMonth() + 1).toString().padStart(2, '0')
				const year = date.getFullYear()
				dateString = `${day}/${month}/${year}`
			} else {
				// English: MM/dd/yyyy
				const month = (date.getMonth() + 1).toString().padStart(2, '0')
				const day = date.getDate().toString().padStart(2, '0')
				const year = date.getFullYear()
				dateString = `${month}/${day}/${year}`
			}
		}
	}

	return [dateString, timeString]
}

// Milliseconds left until the next UTC boundary of the given slot size (hours).
export function getTimeToNextSlot(slotHours: number): number {
	const now = new Date()
	const nextBoundary = new Date(now)
	const nextBoundaryHour = (Math.floor(now.getUTCHours() / slotHours) + 1) * slotHours
	nextBoundary.setUTCHours(nextBoundaryHour, 0, 0, 0)
	return nextBoundary.getTime() - now.getTime()
}

// Solid icon for the active tab, regular for the rest.
export function tabIconClassBuilder(index: number, activeTab: number, icon: string) {
	return `${activeTab === index ? "fas" : "far"} fa-${icon}`
}
