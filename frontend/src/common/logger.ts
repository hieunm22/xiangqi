export class CustomConsole {
	// Public for testing purposes.
	public out: {
		error(...args: any[]): void
		warn(...args: any[]): void
		info(...args: any[]): void
		log(...args: any[]): void
	}

	constructor() {
		this.out = console
	}

	public log(...args: any[]): void {
		if (import.meta.env.NODE_ENV === "production") {
			return
		}

		this.out.log(...args)
	}

	public warn(...args: any[]): void {
		if (import.meta.env.NODE_ENV === "production") {
			return
		}

		this.out.warn(...args)
	}

	public error(...args: any[]): void {
		if (import.meta.env.NODE_ENV === "production") {
			return
		}

		this.out.error(...args)
	}
}
