import { DEFAULT_GAME_TYPE, GameType } from "common/variants"
import { chessEngine } from "./chess"
import { RoomEngine } from "./types"
import { xiangqiEngine } from "./xiangqi"

export * from "./types"

const ENGINES: Record<GameType, RoomEngine> = {
	xiangqi: xiangqiEngine,
	chess: chessEngine
}

/** Resolve the board engine for a game type, falling back to the default. */
export function getRoomEngine(gameType?: GameType | null): RoomEngine {
	return ENGINES[gameType ?? DEFAULT_GAME_TYPE] ?? ENGINES[DEFAULT_GAME_TYPE]
}
