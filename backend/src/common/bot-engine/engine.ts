import { ChildProcessWithoutNullStreams, spawn } from "child_process"
import { DifficultyConfig } from "./difficulty"
import { DEFAULT_ENGINE_PATH, ENGINE_MOVE_TIMEOUT_MS } from "./constants"

/**
 * Thin async wrapper around a fairy-stockfish UCI process for xiangqi.
 * Exposes `findBestMove(fen, config)`; not concurrent — one call at a time.
 */
export class UciEngine {
	private process: ChildProcessWithoutNullStreams | null = null
	private stdoutBuffer = ""
	private listeners: Array<(line: string) => void> = []
	private currentSkillLevel: number | null = null
	private currentMultiPV: number | null = null
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

	async findBestMove(standardFen: string, config: DifficultyConfig): Promise<string | null> {
		if (!this.process) {
			throw new Error("UciEngine.init() must be called before findBestMove")
		}

		this.applySkillLevel(config)
		this.applyMultiPV(1)
		this.writeLine(`position fen ${standardFen}`)

		const goCmd = `go depth ${config.depth} movetime ${config.movetimeMs}`
		const bestMoveLine = await this.send(goCmd, line => line.startsWith("bestmove"))
		const parts = bestMoveLine.trim().split(/\s+/)
		const move = parts[1]
		if (!move || move === "(none)" || move === "0000") {
			return null
		}
		return move
	}

	/**
	 * Like `findBestMove` but returns up to `multipv` ranked alternatives (MultiPV).
	 * Used to avoid losing moves (e.g. perpetual check). Returns [] if no legal moves.
	 */
	async findBestMoves(standardFen: string, config: DifficultyConfig, multipv: number): Promise<string[]> {
		if (!this.process) {
			throw new Error("UciEngine.init() must be called before findBestMoves")
		}

		this.applySkillLevel(config)
		this.applyMultiPV(Math.max(1, multipv))
		this.writeLine(`position fen ${standardFen}`)

		const goCmd = `go depth ${config.depth} movetime ${config.movetimeMs}`
		return this.collectRankedMoves(goCmd)
	}

	private applySkillLevel(config: DifficultyConfig): void {
		if (this.currentSkillLevel !== config.skillLevel) {
			this.writeLine(`setoption name Skill Level value ${config.skillLevel}`)
			this.currentSkillLevel = config.skillLevel
		}
	}

	private applyMultiPV(value: number): void {
		if (this.currentMultiPV !== value) {
			this.writeLine(`setoption name MultiPV value ${value}`)
			this.currentMultiPV = value
		}
	}

	/**
	 * Run a `go` command and collect the best move from each `multipv` PV,
	 * ranked best-first, resolving on the terminal `bestmove` line.
	 */
	private collectRankedMoves(goCmd: string): Promise<string[]> {
		return new Promise((resolve, reject) => {
			const bestByRank = new Map<number, string>()
			const timer = setTimeout(() => {
				this.detach(listener)
				reject(new Error(`UCI command '${goCmd}' timed out after ${ENGINE_MOVE_TIMEOUT_MS}ms`))
			}, ENGINE_MOVE_TIMEOUT_MS)

			const listener = (line: string) => {
				if (line.startsWith("info")) {
					const rankMatch = line.match(/\bmultipv (\d+)\b/)
					const pvMatch = line.match(/\bpv (\S+)/)
					if (rankMatch && pvMatch) {
						bestByRank.set(Number(rankMatch[1]), pvMatch[1])
					}
					return
				}
				if (line.startsWith("bestmove")) {
					clearTimeout(timer)
					this.detach(listener)
					const ranked = [...bestByRank.entries()]
						.sort((a, b) => a[0] - b[0])
						.map(entry => entry[1])
						.filter(move => move !== "(none)" && move !== "0000")
					if (ranked.length === 0) {
						// No `info multipv` lines seen — fall back to the bestmove line.
						const move = line.trim().split(/\s+/)[1]
						if (move && move !== "(none)" && move !== "0000") {
							ranked.push(move)
						}
					}
					resolve(ranked)
				}
			}
			this.listeners.push(listener)
			this.writeLine(goCmd)
		})
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
	 * Send a UCI command and wait for a line satisfying `until`.
	 * Resolves immediately if `until` is omitted.
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
