export { }

declare global {
	interface String {
		format(...args: any): string
	}

	interface ImportMeta {
		readonly env: ImportMetaEnv
	}
}
