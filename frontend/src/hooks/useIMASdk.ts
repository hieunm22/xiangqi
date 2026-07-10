import { useCallback } from "react"

const IMA_SDK_URL = "https://imasdk.googleapis.com/js/sdkloader/ima3.js"

// Kept at module scope so the SDK <script> is injected at most once for the
// whole app, no matter how many dialogs mount.
let loaderPromise: Promise<void> | null = null

const loadImaSdk = (): Promise<void> => {
	if (window.google?.ima) return Promise.resolve()
	if (loaderPromise) return loaderPromise

	loaderPromise = new Promise<void>((resolve, reject) => {
		const script = document.createElement("script")
		script.src = IMA_SDK_URL
		script.async = true
		script.onload = () => resolve()
		script.onerror = () => {
			// Drop the cached promise so a later attempt can retry a blocked or
			// transient load (ad blockers commonly block this script).
			loaderPromise = null
			reject(new Error("Failed to load the Google IMA SDK"))
		}
		document.head.appendChild(script)
	})

	return loaderPromise
}

// Returns a stable loader that resolves once window.google.ima is ready.
export const useIMASdk = () => useCallback(async () => {
	await loadImaSdk()
}, [])
