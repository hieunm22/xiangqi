/* eslint-disable max-lines */
/* eslint-disable max-len */

import type { ReportModel } from "./browser.types"

/*
 * Report browser settings like whatsmybrowser.org
 * Inspired by
 * https://github.com/keithws/browser-report
 */
export function getDeviceInfo() {
	let match: RegExpMatchArray | null

	const userAgent = navigator.userAgent

	// initialize object to store results

	let report: ReportModel = {
		browser: {
			name: null,
			version: null
		},
		os: {
			name: null,
			version: null
		},
		screen: {
			colors: 0,
			dppx: 0,
			height: 0,
			width: 0
		},
		viewport: {
			height: 0,
			width: 0,
			zoom: 0
		}
	}

	// extract browser name from user agent
	if (userAgent.includes("Trident") || userAgent.includes("MSIE")) {
		if (userAgent.includes("Mobile")) {
			report.browser.name = "IE Mobile"
		} else {
			report.browser.name = "Internet Explorer"
		}
	}

	if (userAgent.includes("Firefox") && !userAgent.includes("Seamonkey")) {
		if (userAgent.includes("Android")) {
			report.browser.name = "Firefox for Android"
		} else {
			report.browser.name = "Firefox"
		}
	}

	if (
		userAgent.includes("Safari") &&
		!userAgent.includes("Chrome") &&
		!userAgent.includes("Chromium") &&
		!userAgent.includes("Android")
	) {
		if (userAgent.includes("CriOS")) {
			report.browser.name = "Chrome for iOS"
		} else if (userAgent.includes("FxiOS")) {
			report.browser.name = "Firefox for iOS"
		} else {
			report.browser.name = "Safari"
		}
	}

	if (userAgent.includes("Chrome")) {
		if (userAgent.match(/\bChrome\/[.0-9]* Mobile\b/)) {
			if (userAgent.match(/\bVersion\/\d+\.\d+\b/) || userAgent.match(/\bwv\b/)) {
				report.browser.name = "WebView on Android"
			} else {
				report.browser.name = "Chrome for Android"
			}
		} else {
			report.browser.name = "Chrome"
		}
	}

	if (
		userAgent.includes("Android") &&
		!userAgent.includes("Chrome") &&
		!userAgent.includes("Chromium") &&
		!userAgent.includes("Trident") &&
		!userAgent.includes("Firefox")
	) {
		report.browser.name = "Android Browser"
	}

	if (userAgent.includes("Edge")) {
		report.browser.name = "Edge"
	}

	if (userAgent.includes("UCBrowser")) {
		report.browser.name = "UC Browser for Android"
	}

	if (userAgent.includes("SamsungBrowser")) {
		report.browser.name = "Samsung Internet"
	}

	if (userAgent.includes("OPR") || userAgent.includes("Opera")) {
		if (userAgent.includes("Opera Mini")) {
			report.browser.name = "Opera Mini"
		} else if (
			userAgent.includes("Opera Mobi") ||
			userAgent.includes("Opera Tablet") ||
			userAgent.includes("Mobile")
		) {
			report.browser.name = "Opera Mobile"
		} else {
			report.browser.name = "Opera"
		}
	}

	if (
		userAgent.includes("BB10") ||
		userAgent.includes("PlayBook") ||
		userAgent.includes("BlackBerry")
	) {
		report.browser.name = "BlackBerry"
	}

	if (userAgent.includes("MQQBrowser")) {
		report.browser.name = "QQ Browser"
	}

	// extract browser version number from user agent
	match = null

	switch (report.browser.name) {
		case "Chrome":
		case "Chrome for Android":
		case "WebView on Android":
			match = userAgent.match(/Chrome\/((\d+\.)+\d+)/)
			break
		case "Firefox":
		case "Firefox for Android":
			match = userAgent.match(/Firefox\/((\d+\.)+\d+)/)
			break
		case "Firefox for iOS":
			match = userAgent.match(/FxiOS\/((\d+\.)+\d+)/)
			break
		case "Edge":
		case "Internet Explorer":
		case "IE Mobile":
			if (userAgent.includes("Edge")) {
				match = userAgent.match(/Edge\/((\d+\.)+\d+)/)
			} else if (userAgent.includes("rv:11")) {
				match = userAgent.match(/rv:((\d+\.)+\d+)/)
			} else if (userAgent.includes("MSIE")) {
				match = userAgent.match(/MSIE ((\d+\.)+\d+)/)
			}

			break
		case "Safari":
			match = userAgent.match(/Version\/((\d+\.)+\d+)/)
			break
		case "Android Browser":
			match = userAgent.match(/Android ((\d+\.)+\d+)/)
			break
		case "UC Browser for Android":
			match = userAgent.match(/UCBrowser\/((\d+\.)+\d+)/)
			break
		case "Samsung Internet":
			match = userAgent.match(/SamsungBrowser\/((\d+\.)+\d+)/)
			break
		case "Opera Mini":
			match = userAgent.match(/Opera Mini\/((\d+\.)+\d+)/)
			break
		case "Opera":
			if (userAgent.match(/OPR/)) {
				match = userAgent.match(/OPR\/((\d+\.)+\d+)/)
			} else if (userAgent.match(/Version/)) {
				match = userAgent.match(/Version\/((\d+\.)+\d+)/)
			} else {
				match = userAgent.match(/Opera\/((\d+\.)+\d+)/)
			}
			break
		case "BlackBerry":
			match = userAgent.match(/Version\/((\d+\.)+\d+)/)
			break
		case "QQ Browser":
			match = userAgent.match(/MQQBrowser\/((\d+\.)+\d+)/)
			break
		default:
			match = userAgent.match(/\/((\d+\.)+\d+)$/)
			break
	}

	if (match && match[1]) {
		report.browser.version = match[1]
	}

	// pull in browser window size from the visual viewport
	report.viewport.width = window.innerWidth || document.documentElement.clientWidth
	report.viewport.height = window.innerHeight || document.documentElement.clientHeight

	/*
	 * test if Object.defineProperty function is fully supported
	 */
	let definePropertySupported: boolean
	try {
		Object.defineProperty({}, "x", {})
		definePropertySupported = true
	} catch (e) {
		definePropertySupported = false
	}

	// define viewport zoom property
	report.viewport.zoom = document.documentElement.clientWidth / report.viewport.width

	// extract operating system name from user agent
	if (userAgent.includes("Windows")) {
		if (userAgent.includes("Windows Phone")) {
			report.os.name = "Windows Phone"
		} else {
			report.os.name = "Windows"
		}
	}

	if (userAgent.includes("OS X") && !userAgent.includes("Android")) {
		report.os.name = "OS X"
	}

	if (userAgent.includes("Linux")) {
		report.os.name = "Linux"
	}

	if (userAgent.includes("like Mac OS X")) {
		report.os.name = "iOS"
	}

	if (
		(userAgent.includes("Android") || userAgent.includes("Adr")) &&
		!userAgent.includes("Windows Phone")
	) {
		report.os.name = "Android"
	}

	if (userAgent.includes("BB10")) {
		report.os.name = "BlackBerry"
	}

	if (userAgent.includes("RIM Tablet OS")) {
		report.os.name = "BlackBerry Tablet OS"
	}

	if (userAgent.includes("BlackBerry")) {
		report.os.name = "BlackBerryOS"
	}

	if (userAgent.includes("CrOS")) {
		report.os.name = "Chrome OS"
	}

	if (userAgent.includes("KAIOS")) {
		report.os.name = "KaiOS"
	}

	// extract operating system version from user agent
	match = null

	switch (report.os.name) {
		case "Windows":
		case "Windows Phone":
			if (userAgent.includes("Win16")) {
				report.os.version = "3.1.1"
			} else if (userAgent.includes("Windows CE")) {
				report.os.version = "CE"
			} else if (userAgent.includes("Windows 95")) {
				report.os.version = "95"
			} else if (userAgent.includes("Windows 98")) {
				if (userAgent.includes("Windows 98; Win 9x 4.90")) {
					report.os.version = "Millennium Edition"
				} else {
					report.os.version = "98"
				}
			} else {
				match = userAgent.match(
					/Win(?:dows)?(?: Phone)?[ _]?(?:(?:NT|9x) )?((?:(\d+\.)*\d+)|XP|ME|CE)\b/
				)

				if (match && match[1]) {
					switch (match[1]) {
						case "6.4":
							// some versions of Firefox mistakenly used 6.4
							match[1] = "10.0"
							break
						case "6.3":
							match[1] = "8.1"
							break
						case "6.2":
							match[1] = "8"
							break
						case "6.1":
							match[1] = "7"
							break
						case "6.0":
							match[1] = "Vista"
							break
						case "5.2":
							match[1] = "Server 2003"
							break
						case "5.1":
							match[1] = "XP"
							break
						case "5.01":
							match[1] = "2000 SP1"
							break
						case "5.0":
							match[1] = "2000"
							break
						case "4.0":
							match[1] = "4.0"
							break
						default:
							// nothing
							break
					}
				}
			}
			break
		case "OS X":
			match = userAgent.match(/OS X ((\d+[._])+\d+)\b/)
			break
		case "Linux":
			// linux user agent strings do not usually include the version
			report.os.version = null
			break
		case "iOS":
			match = userAgent.match(/OS ((\d+[._])+\d+) like Mac OS X/)
			break
		case "Android":
			match = userAgent.match(/(?:Android|Adr) (\d+([._]\d+)*)/)
			break
		case "BlackBerry":
		case "BlackBerryOS":
			match = userAgent.match(/Version\/((\d+\.)+\d+)/)
			break
		case "BlackBerry Tablet OS":
			match = userAgent.match(/RIM Tablet OS ((\d+\.)+\d+)/)
			break
		case "Chrome OS":
			report.os.version = report.browser.version
			break
		case "KaiOS":
			match = userAgent.match(/KAIOS\/(\d+(\.\d+)*)/)
			break
		default:
			// no good default behavior
			report.os.version = null
			break
	}

	if (match && match[1]) {
		// replace underscores in version number with periods
		match[1] = match[1].replace(/_/g, ".")
		report.os.version = match[1]
	}

	// handle Mac OS X / OS X / macOS naming conventions
	if (report.os.name === "OS X" && report.os.version) {
		const versions = report.os.version.split(".")
		if (versions.length >= 2) {
			const minorVersion = parseInt(versions[1], 10)
			if (minorVersion <= 7) {
				report.os.name = "Mac OS X"
			} else if (minorVersion >= 12) {
				report.os.name = "macOS"
			} else {
				report.os.name = "OS X"
			}
		}
	}

	// pull in screen info from W3C standard properties
	report.screen.width = screen.width
	report.screen.height = screen.height
	report.screen.colors = screen.colorDepth
	if (window.devicePixelRatio && !isNaN(window.devicePixelRatio)) {
		report.screen.dppx = window.devicePixelRatio
	} else {
		report.screen.dppx = 1
	}

	if (definePropertySupported) {
		Object.defineProperty(report.os, "getInformation", {
			get: function () {
				if (!report.os) {
					return report.os
				}
				return `${report.os.name} ${report.os.version}`
			}
		})
		Object.defineProperty(report.browser, "getInformation", {
			get: function () {
				if (!report.browser) {
					return "Undefined browser name"
				}
				return `${report.browser.name} ${report.browser.version}`
			}
		})
		Object.defineProperty(report.browser, "size", {
			get: function () {
				return report.viewport.width + " x " + report.viewport.height
			}
		})
		Object.defineProperty(report.screen, "size", {
			get: function () {
				return report.screen.width + " x " + report.screen.height
			}
		})
		Object.defineProperty(report.screen, "resolution", {
			get: function () {
				const { dppx, width, height } = report.screen
				return dppx * width + " x " + dppx * height
			}
		})
	}

	report.os.getOSInformation = function () {
		if (!report.os) {
			return "Undefined operation name"
		}
		return `${report.os.name} ${report.os.version}`
	}

	return report
}
