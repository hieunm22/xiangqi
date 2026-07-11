import {
	LS_LANGUAGE,
	LS_TOKEN_KEY
} from "./constant"
import { CustomConsole } from "./logger"
import { translate } from "locales/translate"

String.prototype.format = function(...args: any) {
	return this.toString().replace(/{(\d+)}/g, (match, index) => {
		return typeof args[index] !== "undefined" ? args[index] : match
	})
}

export const logger = new CustomConsole()


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
