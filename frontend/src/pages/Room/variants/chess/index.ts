import { CellProps } from "types/GameState"
import { INITIAL_FEN_CHESS } from "./constants"
import { chessFenToBoard } from "./rules"

export * from "./rules"
export { INITIAL_FEN_CHESS } from "./constants"

/** Fresh board in the standard chess starting position. */
export function initChessBoard(): CellProps[] {
	return chessFenToBoard(INITIAL_FEN_CHESS)
}
