import { useCallback } from "react"

const FACEBOOK_APP_ID = import.meta.env.VITE_FACEBOOK_APP_ID
const FACEBOOK_SDK_URL = "https://connect.facebook.net/en_US/sdk.js"
const FACEBOOK_GRAPH_VERSION = "v19.0"

// Kept at module scope so the SDK <script> is injected + initialized at most once
// for the whole app, no matter how many views mount.
let loaderPromise: Promise<void> | null = null

const loadFacebookSdk = (): Promise<void> => {
	if (window.FB) return Promise.resolve()
	if (loaderPromise) return loaderPromise

	loaderPromise = new Promise<void>((resolve, reject) => {
		const script = document.createElement("script")
		script.src = FACEBOOK_SDK_URL
		script.async = true
		script.defer = true
		script.crossOrigin = "anonymous"
		script.onload = () => {
			window.FB.init({
				appId: FACEBOOK_APP_ID,
				cookie: false,
				xfbml: false,
				version: FACEBOOK_GRAPH_VERSION
			})
			resolve()
		}
		script.onerror = () => {
			// Drop the cached promise so a later attempt can retry a blocked or
			// transient load (ad blockers commonly block this script).
			loaderPromise = null
			reject(new Error("Failed to load the Facebook SDK"))
		}
		document.head.appendChild(script)
	})

	return loaderPromise
}

/**
 * Loads the Facebook JS SDK and exposes a click-triggered `login()` that opens
 * the Facebook popup and resolves with a short-lived user access token
 *
 * `isConfigured` is false when VITE_FACEBOOK_APP_ID is unset, so callers can hide
 * the button instead of rendering a broken one.
 */
export const useFacebookAuth = () => {
	const login = useCallback(async (): Promise<string> => {
		await loadFacebookSdk()

		return new Promise<string>((resolve, reject) => {
			window.FB.login(
				(response: { authResponse?: { accessToken?: string } }) => {
					const accessToken = response?.authResponse?.accessToken
					if (accessToken) {
						resolve(accessToken)
					} else {
						reject(new Error("Facebook login was cancelled"))
					}
				},
				{ scope: "email" }
			)
		})
	}, [])

	return { login, isConfigured: Boolean(FACEBOOK_APP_ID) }
}
