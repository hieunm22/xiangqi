import type { DropdownProps } from "types/Common"

export const LS_TOKEN_KEY = "xiangqi-token"
export const LS_DARKMODE = "dark-mode"
export const LS_LANGUAGE = "language"
export const LS_DEBUG = "debug-mode"
export const BOARD_COLUMNS = 9
export const BOARD_ROWS = 10

export const LUCKY_WHEEL_SLOT_HOURS = 6

// Google IMA VAST tag for the rewarded "watch video" ad.
export const AD_TAG_URL =
	import.meta.env.VITE_AD_TAG_URL ||
	"https://pubads.g.doubleclick.net/gampad/ads?iu=/21775744923/external/single_preroll_skippable&sz=640x480&ciu_szs=300x250%2C728x90&gdfp_req=1&output=vast&unviewed_position_start=1&env=vp&correlator="

export const COUNTRIES_OPTIONS: DropdownProps[] = [
	{
		key: "en",
		icon: "https://cdn.jsdelivr.net/npm/twemoji@latest/2/svg/1f1fa-1f1f8.svg",
		value: "English"
	},
	{
		key: "vi",
		icon: "https://cdn.jsdelivr.net/npm/twemoji@latest/2/svg/1f1fb-1f1f3.svg",
		value: "Tiếng Việt"
	}
	// {
	// 	key: "jp",
	// 	icon: "https://cdn.jsdelivr.net/npm/twemoji@latest/2/svg/1f1ef-1f1f5.svg",
	// 	value: "日本語",
	// 	 disabled: true
	// },
	// {
	// 	key: "kr",
	// 	icon: "https://cdn.jsdelivr.net/npm/twemoji@latest/2/svg/1f1f0-1f1f7.svg",
	// 	value: "한국인",
	// 	disabled: true
	// },
	// {
	// 	key: "cn",
	// 	icon: "https://cdn.jsdelivr.net/npm/twemoji@latest/2/svg/1f1e8-1f1f3.svg",
	// 	value: "中国人",
	// 	disabled: true
	// }
]

export const HOME_PATH = "/"
export const LOGIN_PATH = "/login"
export const REGISTER_PATH = "/register"
export const LOST_PASSWORD_PATH = "/forgot-password"
export const RESET_PASSWORD_PATH = "/reset-password"
