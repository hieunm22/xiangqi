interface BrowserModel {
	name: string | null
	version: string | null
	getOSInformation: () => string
}

interface ScreenModel {
	colors: number
	dppx: number
	height: number
	width: number
}

interface ViewportModel {
	height: number
	width: number
	zoom: number
}

export type OSModel = BrowserModel

export interface ReportModel {
	browser: Partial<BrowserModel>
	os: Partial<OSModel>
	screen: ScreenModel
	viewport: ViewportModel
}
