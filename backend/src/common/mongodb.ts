import { Db, MongoClient } from "mongodb"

let cachedClient: MongoClient | null = null
let cachedDb: Db | null = null

export const getMongoDb = async (): Promise<Db> => {
	if (cachedDb) {
		return cachedDb
	}

	const mongoUri = process.env.MONGO_CONNECTION_STRING?.trim()
	const mongoDbName = process.env.MONGODB_DB_NAME?.trim() || "xiangqi"

	if (!mongoUri) {
		throw new Error(
			"Missing MongoDB connection string: set MONGODB_URI, MONGODB_URL, MONGO_CONNECTION_STRING, MONGO_URI, or MONGO_URL"
		)
	}

	cachedClient = new MongoClient(mongoUri)
	await cachedClient.connect()
	cachedDb = cachedClient.db(mongoDbName)

	return cachedDb
}

export const getGameHistoryCollection = async () => {
	const db = await getMongoDb()
	return db.collection("game_history")
}
