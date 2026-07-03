import "./env"
import { createServer } from "http"
import app from "./app"
import { ensureChatMessageIndexes } from "./common/mongodb"
import { startPresenceSweeper } from "./common/presence"
import { emitPresenceChanged, initializeSocket } from "./common/socket"
import { startAmountReconciler } from "./job/reconcile-amount"

const PORT = Number(process.env.PORT) || 8000

// Create HTTP server and attach Socket.io
const httpServer = createServer(app)
initializeSocket(httpServer)

// Broadcast presence transitions (online -> busy -> inactive -> offline) as heartbeats age.
startPresenceSweeper(emitPresenceChanged)

// Weekly job that reconciles cached total_amount against the GameUser ledger.
startAmountReconciler()

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
