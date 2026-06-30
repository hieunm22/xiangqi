export const LOGIN_SESSION_KEY = "login-session"
export const REFRESH_TOKEN_KEY = "refresh-token"
export const FORGOT_PASSWORD_KEY = "forgot-password"
export const PRESENCE_KEY = "presence-online"
export const PRESENCE_STATUS_KEY = "presence-status"

export const INITIAL_FEN_BLACK_TOP = "RHEAGAEHR/9/1C5C1/S1S1S1S1S/9/9/s1s1s1s1s/1c5c1/9/rheagaehr"
export const INITIAL_FEN_BLACK_BOTTOM = "rheagaehr/9/1c5c1/s1s1s1s1s/9/9/S1S1S1S1S/1C5C1/9/RHEAGAEHR"

// Starting score every user is seeded with. Used to recompute the correct balance from the GameUser ledger.
export const INITIAL_AMOUNT = 200

export const ACCESS_TOKEN_EXPIRES_IN = "1h"
export const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60
