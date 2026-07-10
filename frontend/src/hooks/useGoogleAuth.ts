import { useEffect, useRef, useState } from "react"
import i18n from "locales/i18n"

const GIS_SDK_URL = "https://accounts.google.com/gsi/client"
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID
const GOOGLE_FALLBACK_LOCALE = "en"
const GOOGLE_SUPPORTED_LOCALES = new Set(["en", "vi"])

// Kept at module scope so the GIS <script> is injected at most once for the
// whole app, no matter how many login views mount.
let loaderPromise: Promise<void> | null = null

// Initialize once and route the credential to whichever hook is currently mounted.
let isGoogleInitialized = false
let activeCredentialHandler: ((credential: string) => void) | null = null

const normalizeGoogleLocale = (language?: string) => {
	if (!language) return GOOGLE_FALLBACK_LOCALE
	const normalized = language.toLowerCase().replace("_", "-")
	const baseLanguage = normalized.split("-")[0]
	return GOOGLE_SUPPORTED_LOCALES.has(baseLanguage) ? baseLanguage : GOOGLE_FALLBACK_LOCALE
}

const loadGoogleIdentityServices = (): Promise<void> => {
	if (window.google?.accounts?.id) return Promise.resolve()
	if (loaderPromise) return loaderPromise

	loaderPromise = new Promise<void>((resolve, reject) => {
		const script = document.createElement("script")
		script.src = GIS_SDK_URL
		script.async = true
		script.defer = true
		script.onload = () => resolve()
		script.onerror = () => {
			// Drop the cached promise so a later attempt can retry a blocked or
			// transient load (ad blockers commonly block this script).
			loaderPromise = null
			reject(new Error("Failed to load Google Identity Services"))
		}
		document.head.appendChild(script)
	})

	return loaderPromise
}

interface UseGoogleAuthParams {
	onCredential: (credential: string) => void
	onError?: (error: Error) => void
}

/**
 * Loads Google Identity Services and renders the official localized Google sign-in
 * button into the returned ref. On success the button's callback yields a Google
 * ID token (the `credential`) that the backend verifies at POST /api/auth/google.
 *
 * `isConfigured` is false when VITE_GOOGLE_CLIENT_ID is unset, so the caller can
 * hide the button instead of rendering a broken one.
 */
export const useGoogleAuth = ({ onCredential, onError }: UseGoogleAuthParams) => {
	const buttonRef = useRef<HTMLDivElement | null>(null)
	const [googleLocale, setGoogleLocale] = useState(() =>
		normalizeGoogleLocale(i18n.resolvedLanguage || i18n.language)
	)
	// Keep the latest callbacks pointed at this (currently mounted) hook without
	// re-running the load effect on every render
	const errorRef = useRef(onError)
	useEffect(() => {
		errorRef.current = onError
		activeCredentialHandler = onCredential
	})

	useEffect(() => {
		const onLanguageChanged = (language: string) => {
			setGoogleLocale(normalizeGoogleLocale(language))
		}

		i18n.on("languageChanged", onLanguageChanged)

		return () => {
			i18n.off("languageChanged", onLanguageChanged)
		}
	}, [])

	useEffect(() => {
		if (!GOOGLE_CLIENT_ID) return

		let cancelled = false

		loadGoogleIdentityServices()
			.then(() => {
				if (cancelled || !buttonRef.current || !window.google?.accounts?.id) return
				buttonRef.current.innerHTML = ""
				const parentWidth = buttonRef.current.parentElement?.clientWidth ?? 0
				const buttonWidth = Math.floor(parentWidth || buttonRef.current.clientWidth)

				if (!isGoogleInitialized) {
					window.google.accounts.id.initialize({
						client_id: GOOGLE_CLIENT_ID,
						callback: (response: { credential?: string }) => {
							if (response?.credential) {
								activeCredentialHandler?.(response.credential)
							}
						}
					})
					isGoogleInitialized = true
				}

				window.google.accounts.id.renderButton(buttonRef.current, {
					type: "standard",
					theme: "outline",
					size: "large",
					text: "signin_with",
					locale: googleLocale,
					shape: "rectangular",
					width: buttonWidth > 0 ? buttonWidth : 280
				})
			})
			.catch((err: unknown) => {
				errorRef.current?.(err instanceof Error ? err : new Error(String(err)))
			})

		return () => {
			cancelled = true
		}
	}, [googleLocale])

	return { buttonRef, isConfigured: Boolean(GOOGLE_CLIENT_ID) }
}
