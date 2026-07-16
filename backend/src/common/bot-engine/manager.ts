import { ENGINE_IDLE_TIMEOUT_MS } from "./constants"
import { UciEngine } from "./engine"

interface EngineSlot {
	engine: UciEngine
	idleTimer: NodeJS.Timeout
}

/**
 * Per-game engine pool. Each PvE game owns one fairy-stockfish process for the duration
 * of the game; it is killed on explicit release or after a long idle period.
 */
class EngineManager {
	private slots = new Map<string, EngineSlot>()
	private engineFactory: () => UciEngine

	constructor(engineFactory: () => UciEngine = () => new UciEngine()) {
		this.engineFactory = engineFactory
	}

	// Override the factory in tests to inject a fake.
	setEngineFactory(factory: () => UciEngine): void {
		this.engineFactory = factory
	}

	async getEngineForGame(gameId: string): Promise<UciEngine> {
		const existing = this.slots.get(gameId)
		if (existing) {
			this.resetIdleTimer(gameId)
			return existing.engine
		}
		const engine = this.engineFactory()
		await engine.init()
		this.slots.set(gameId, {
			engine,
			idleTimer: this.makeIdleTimer(gameId)
		})
		return engine
	}

	async releaseEngine(gameId: string): Promise<void> {
		const slot = this.slots.get(gameId)
		if (!slot) {
			return
		}
		clearTimeout(slot.idleTimer)
		this.slots.delete(gameId)
		await slot.engine.quit()
	}

	async releaseAll(): Promise<void> {
		const ids = Array.from(this.slots.keys())
		await Promise.all(ids.map(id => this.releaseEngine(id)))
	}

	private resetIdleTimer(gameId: string): void {
		const slot = this.slots.get(gameId)
		if (!slot) {
			return
		}
		clearTimeout(slot.idleTimer)
		slot.idleTimer = this.makeIdleTimer(gameId)
	}

	private makeIdleTimer(gameId: string): NodeJS.Timeout {
		return setTimeout(() => {
			void this.releaseEngine(gameId).catch(err =>
				console.error(`[bot-engine] failed to release idle engine for game ${gameId}:`, err)
			)
		}, ENGINE_IDLE_TIMEOUT_MS)
	}
}

export const engineManager = new EngineManager()
export { EngineManager }
