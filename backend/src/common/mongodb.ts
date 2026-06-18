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

export const getChatMessageCollection = async () => {
	const db = await getMongoDb()
	return db.collection("chat_message")
}

export const ensureChatMessageIndexes = async () => {
	try {
		const collection = await getChatMessageCollection()

		await collection.createIndexes([
			{
				key: { conversation_key: 1, timestamp: -1 },
				name: "idx_conversation_timestamp"
			},
			{
				key: { sender_id: 1, timestamp: -1 },
				name: "idx_sender_timestamp"
			},
			{
				key: { receiver_id: 1, timestamp: -1 },
				name: "idx_receiver_timestamp"
			}
		])

		console.log("Chat message indexes ensured successfully")
	} catch (error) {
		console.error("Failed to ensure chat message indexes:", error)
		throw error
	}
}
