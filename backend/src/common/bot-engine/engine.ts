import { ChildProcessWithoutNullStreams, spawn } from "child_process"
import { DifficultyConfig } from "./difficulty"
import { DEFAULT_ENGINE_PATH, ENGINE_MOVE_TIMEOUT_MS } from "./constants"

/**
 * Thin async wrapper around a fairy-stockfish UCI child process.
 *
 * Spawns one process per instance, runs UCI handshake, sets the xiangqi variant, and
 * exposes `findBestMove(fen, config)` for issuing search requests.
 *
 * Not designed for concurrent calls — callers must await each `findBestMove` before
 * the next. The manager ensures one engine per game so this is naturally serial.
 */
export class UciEngine {
	private process: ChildProcessWithoutNullStreams | null = null
	private stdoutBuffer = ""
	private listeners: Array<(line: string) => void> = []
	private currentSkillLevel: number | null = null
	private readonly enginePath: string

	constructor(enginePath: string = DEFAULT_ENGINE_PATH) {
		this.enginePath = enginePath
	}

	async init(): Promise<void> {
		if (this.process) {
			return
		}
		this.process = spawn(this.enginePath, [], { stdio: ["pipe", "pipe", "pipe"] })

		this.process.stdout.setEncoding("utf-8")
		this.process.stdout.on("data", chunk => this.handleStdout(chunk))
		this.process.on("error", err => {
			console.error("[bot-engine] process error:", err)
		})

		await this.send("uci", line => line === "uciok")
		await this.send("setoption name UCI_Variant value xiangqi")
		await this.send("isready", line => line === "readyok")
	}

	async findBestMove(standardFen: string, config: DifficultyConfig): Promise<string> {
		if (!this.process) {
			throw new Error("UciEngine.init() must be called before findBestMove")
		}

		if (this.currentSkillLevel !== config.skillLevel) {
			this.writeLine(`setoption name Skill Level value ${config.skillLevel}`)
			this.currentSkillLevel = config.skillLevel
		}

		this.writeLine(`position fen ${standardFen}`)

		const goCmd = `go depth ${config.depth} movetime ${config.movetimeMs}`
		const bestMoveLine = await this.send(goCmd, line => line.startsWith("bestmove"))
		const parts = bestMoveLine.trim().split(/\s+/)
		const move = parts[1]
		if (!move || move === "(none)" || move === "0000") {
			throw new Error(`Engine returned no move: '${bestMoveLine}'`)
		}
		return move
	}

	async quit(): Promise<void> {
		if (!this.process) {
			return
		}
		try {
			this.writeLine("quit")
		} catch {
			// process may already be dead
		}
		const proc = this.process
		this.process = null
		await new Promise<void>(resolve => {
			const timer = setTimeout(() => {
				try {
					proc.kill("SIGKILL")
				} catch {
					/* noop */
				}
				resolve()
			}, 1000)
			proc.once("exit", () => {
				clearTimeout(timer)
				resolve()
			})
		})
	}

	private writeLine(line: string): void {
		if (!this.process) {
			throw new Error("Engine process is not running")
		}
		this.process.stdin.write(`${line}\n`)
	}

	/**
	 * Send a UCI command and wait for a line that satisfies `until`. If `until` is
	 * omitted the promise resolves immediately after the write.
	 */
	private send(cmd: string, until?: (line: string) => boolean): Promise<string> {
		return new Promise((resolve, reject) => {
			if (!until) {
				this.writeLine(cmd)
				resolve("")
				return
			}
			const timer = setTimeout(() => {
				this.detach(listener)
				reject(new Error(`UCI command '${cmd}' timed out after ${ENGINE_MOVE_TIMEOUT_MS}ms`))
			}, ENGINE_MOVE_TIMEOUT_MS)

			const listener = (line: string) => {
				if (until(line)) {
					clearTimeout(timer)
					this.detach(listener)
					resolve(line)
				}
			}
			this.listeners.push(listener)
			this.writeLine(cmd)
		})
	}

	private handleStdout(chunk: string): void {
		this.stdoutBuffer += chunk
		let newlineIdx = this.stdoutBuffer.indexOf("\n")
		while (newlineIdx !== -1) {
			const line = this.stdoutBuffer.slice(0, newlineIdx).replace(/\r$/, "")
			this.stdoutBuffer = this.stdoutBuffer.slice(newlineIdx + 1)
			for (const listener of [...this.listeners]) {
				listener(line)
			}
			newlineIdx = this.stdoutBuffer.indexOf("\n")
		}
	}

	private detach(listener: (line: string) => void): void {
		const idx = this.listeners.indexOf(listener)
		if (idx !== -1) {
			this.listeners.splice(idx, 1)
		}
	}
}
