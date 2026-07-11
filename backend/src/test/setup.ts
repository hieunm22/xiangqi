import { vi } from "vitest"

// Global test isolation for the two background I/O clients.
//
// Route handlers fire background work (presence sync, history writes, etc.) that
// isn't awaited by the HTTP response. If a test file doesn't mock the underlying
// Redis / Mongo client, that stray work runs against the REAL servers configured
// in .env.local - a remote connection that hangs the worker for tens of seconds
// and, because it resolves after the test finishes, bleeds into whichever test
// runs next (wrong status codes, timeouts). It only surfaced under full-suite
// load, which is why every file passed in isolation.
//
// Stubbing both clients here makes every test inert by default: Redis/Mongo never
// touch the network. Higher-level helpers (presence-sync, post-game, game-clock)
// need no stub of their own - their real code just calls these no-ops. A test
// that needs specific behaviour still declares its own vi.mock(), which overrides
// this global default for that file.
//
// The stubs use plain functions (not vi.fn) so `clearMocks` / `restoreMocks`
// between tests can't wipe their implementations and leave calls returning
// undefined.

vi.mock("common/redis", () => ({
	default: {
		get: async () => null,
		set: async () => "OK",
		del: async () => 0,
		exists: async () => 0,
		hget: async () => null,
		hset: async () => 1,
		hdel: async () => 0,
		zadd: async () => 1,
		zscore: async () => null,
		zrem: async () => 0,
		zrangebyscore: async () => [],
		zremrangebyscore: async () => 0
	}
}))

vi.mock("common/mongodb", () => {
	const cursor = () => ({
		sort: () => cursor(),
		limit: () => cursor(),
		toArray: async () => []
	})
	const collection = {
		find: () => cursor(),
		findOne: async () => null,
		insertOne: async () => ({ insertedId: "test-object-id", acknowledged: true }),
		insertMany: async () => ({ insertedCount: 0, acknowledged: true }),
		updateOne: async () => ({ matchedCount: 1, modifiedCount: 1, acknowledged: true }),
		updateMany: async () => ({ matchedCount: 0, modifiedCount: 0, acknowledged: true }),
		deleteOne: async () => ({ deletedCount: 0, acknowledged: true }),
		deleteMany: async () => ({ deletedCount: 0, acknowledged: true }),
		countDocuments: async () => 0,
		createIndex: async () => "index"
	}
	return {
		getMongoDb: async () => ({ collection: () => collection }),
		getGameHistoryCollection: async () => collection,
		getChatMessageCollection: async () => collection,
		ensureChatMessageIndexes: async () => undefined
	}
})
