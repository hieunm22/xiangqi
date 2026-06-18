import "./env"
import { createServer } from "http"
import app from "./app"
import { initializeSocket } from "./common/socket"
import { ensureChatMessageIndexes } from "./common/mongodb"

const PORT = Number(process.env.PORT) || 8000

// Create HTTP server and attach Socket.io
const httpServer = createServer(app)
initializeSocket(httpServer)

// Initialize MongoDB indexes
ensureChatMessageIndexes().catch(error => {
	console.error("Failed to initialize indexes:", error)
	process.exit(1)
})

httpServer.listen(PORT, () => {
	console.log(`Xiangqi API server is running on port ${PORT}`)
	console.log(`Swagger docs available at http://localhost:${PORT}/docs`)
	console.log(`Socket.io ready for real-time updates`)
})
