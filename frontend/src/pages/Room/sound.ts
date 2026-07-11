// Reuse one Audio element per effect so rapid moves don't spawn an element per call.
const soundCache: Record<string, HTMLAudioElement> = {}

export function playSound(url: string) {
	if (typeof Audio === "undefined") {
		return
	}
	if (!soundCache[url]) {
		soundCache[url] = new Audio(url)
	}
	const sound = soundCache[url]
	sound.currentTime = 0
	// Autoplay can reject (e.g. before any user interaction); ignore it.
	sound.play().catch(() => {})
}
