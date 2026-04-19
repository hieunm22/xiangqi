import type { DropdownProps } from "types/Common"

export const LS_DARKMODE = "dark-mode"
export const LS_LANGUAGE = "language"
export const LS_BOARD = "board"
export const LS_CAPTURED_PIECES = "captured-pieces"
export const LS_TURN = "turn"

export const COUNTRIES_DROPDOWN: DropdownProps[] = [
	{
		key: "en",
		icon: "https://cdn.jsdelivr.net/npm/twemoji@latest/2/svg/1f1fa-1f1f8.svg",
		value: "United States (English)"
	},
	{
		key: "vi",
		icon: "https://cdn.jsdelivr.net/npm/twemoji@latest/2/svg/1f1fb-1f1f3.svg",
		value: "Tiếng Việt (Vietnamese)"
	}
	// {
	// 	key: "jp",
	// 	icon: "https://cdn.jsdelivr.net/npm/twemoji@latest/2/svg/1f1ef-1f1f5.svg",
	// 	value: "日本語 (Japanese)",
	// 	 disabled: true
	// },
	// {
	// 	key: "kr",
	// 	icon: "https://cdn.jsdelivr.net/npm/twemoji@latest/2/svg/1f1f0-1f1f7.svg",
	// 	value: "한국인 (Korean)",
	// 	disabled: true
	// },
	// {
	// 	key: "cn",
	// 	icon: "https://cdn.jsdelivr.net/npm/twemoji@latest/2/svg/1f1e8-1f1f3.svg",
	// 	value: "中国人 (Chinese)",
	// 	disabled: true
	// }
]
