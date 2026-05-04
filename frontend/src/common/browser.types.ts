export interface BrowserModel {
	name: string | null
	version: string | null
	getOSInformation: () => string
}

export type OSModel = BrowserModel

export interface ScreenModel {
	colors: number
	dppx: number
	height: number
	width: number
}

export interface ViewportModel {
	height: number
	width: number
	zoom: number
}

export interface ReportModel {
	browser: Partial<BrowserModel>
	os: Partial<OSModel>
	screen: ScreenModel
	viewport: ViewportModel
}
