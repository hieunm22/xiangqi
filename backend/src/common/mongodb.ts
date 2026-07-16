import { Db, MongoClient } from "mongodb"

let cachedClient: MongoClient | null = null
let cachedDb: Db | null = null

export const getMongoDb = async (): Promise<Db> => {
	if (cachedDb) {
		return cachedDb
	}

	const serverName = process.env.SERVER_IP?.trim() || "localhost"
	const mongoDbName = process.env.MONGODB_DB_NAME?.trim() || "xiangqi"
	const mongoPassword = process.env.MONGO_PASSWORD?.trim()

	if (!mongoPassword) {
		throw new Error(
			"Missing MongoDB password: set MONGO_PASSWORD in your environment variables"
		)
	}

	const mongoUri = `mongodb://root:${mongoPassword}@${serverName}:27017/?authSource=admin`

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
