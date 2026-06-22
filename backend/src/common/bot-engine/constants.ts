export const BOT_USER_ID = 9223372036854n

export const MIN_DIFFICULTY = 1
export const MAX_DIFFICULTY = 5

export const DEFAULT_ENGINE_PATH = process.env.FAIRY_STOCKFISH_PATH || "fairy-stockfish"

// Kill engine if no move requested for this duration (ms)
export const ENGINE_IDLE_TIMEOUT_MS = 10 * 60 * 1000

// Max time to wait for a bestmove response (ms). Safety net per move.
export const ENGINE_MOVE_TIMEOUT_MS = 30 * 1000

export const BOARD_COLUMNS = 9
export const BOARD_ROWS = 10
export const BOARD_SIZE = BOARD_COLUMNS * BOARD_ROWS
