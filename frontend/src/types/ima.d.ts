export {}

declare global {
	interface Window {
		// The Google IMA HTML5 SDK is injected at runtime by useIMASdk
		google?: any
	}
}
