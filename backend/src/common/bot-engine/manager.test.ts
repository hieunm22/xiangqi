import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { EngineManager } from "./manager"
import { UciEngine } from "./engine"

class FakeEngine {
	initCalled = 0
	quitCalled = 0
	async init() {
		this.initCalled += 1
	}
	async quit() {
		this.quitCalled += 1
	}
}

describe("EngineManager", () => {
	beforeEach(() => {
		vi.useFakeTimers()
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	it("creates one engine per gameId and reuses it on subsequent calls", async () => {
		const created: FakeEngine[] = []
		const manager = new EngineManager(() => {
			const e = new FakeEngine()
			created.push(e)
			return e as unknown as UciEngine
		})

		const a = await manager.getEngineForGame("game-1")
		const b = await manager.getEngineForGame("game-1")
		const c = await manager.getEngineForGame("game-2")

		expect(a).toBe(b)
		expect(a).not.toBe(c)
		expect(created).toHaveLength(2)
		expect(created[0].initCalled).toBe(1)
	})

	it("quits the engine on release and forgets the slot", async () => {
		const fake = new FakeEngine()
		const manager = new EngineManager(() => fake as unknown as UciEngine)

		await manager.getEngineForGame("game-1")
		await manager.releaseEngine("game-1")
		expect(fake.quitCalled).toBe(1)

		// Getting again should spin up a fresh engine, so init is called twice total.
		await manager.getEngineForGame("game-1")
		expect(fake.initCalled).toBe(2)
	})

	it("auto-releases idle engines after the idle timeout", async () => {
		const fake = new FakeEngine()
		const manager = new EngineManager(() => fake as unknown as UciEngine)

		await manager.getEngineForGame("game-1")
		// Idle timeout is 10 minutes; advance just past it.
		await vi.advanceTimersByTimeAsync(10 * 60 * 1000 + 100)
		expect(fake.quitCalled).toBe(1)
	})
})
