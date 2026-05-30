import "./env"
import { createServer } from "http"
import app from "./app"
import { initializeSocket } from "./common/socket"

const PORT = Number(process.env.PORT) || 8000

// Create HTTP server and attach Socket.io
const httpServer = createServer(app)
initializeSocket(httpServer)

httpServer.listen(PORT, () => {
	console.log(`Xiangqi API server is running on port ${PORT}`)
	console.log(`Swagger docs available at http://localhost:${PORT}/docs`)
	console.log(`Socket.io ready for real-time updates`)
})
