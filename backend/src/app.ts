import express, { Request, Response } from "express"
import swaggerUi from "swagger-ui-express"
import swaggerSpec from "./swagger"
import cors from "cors"
import cookieParser from "cookie-parser"

import getUsersRoutes from "./routes/auth/get-user"
import loginRoutes from "./routes/auth/login"
import logoutRoutes from "./routes/auth/logout"
import refreshTokenRoutes from "./routes/auth/refresh-token"
import validateTokenRoutes from "./routes/auth/validate-token"

import createGameRoutes from "./routes/game/create-game"
import fetchGamesRoutes from "./routes/game/fetch-games"
import joinGameRoutes from "./routes/game/join-game"
import leaveGameRoutes from "./routes/game/leave-game"
import loadGameRoutes from "./routes/game/load-game"
import setGameStatusRoutes from "./routes/game/set-game-status"

const app = express()

const rawOrigins = process.env.CORS_ORIGINS ?? "http://localhost:3004"
const allowedOrigins = rawOrigins.split(",").map(o => o.trim()).filter(Boolean)

// Allow Swagger UI (same host as the API server) to make requests
const port = process.env.PORT ?? "8000"
const swaggerOrigin = `http://localhost:${port}`
if (!allowedOrigins.includes(swaggerOrigin)) {
	allowedOrigins.push(swaggerOrigin)
}

app.use(
	cors({
		origin: (requestOrigin, callback) => {
			// Allow server-to-server calls (no origin) or whitelisted origins
			if (!requestOrigin || allowedOrigins.includes(requestOrigin)) {
				callback(null, requestOrigin || true)
			} else {
				callback(new Error(`CORS: origin '${requestOrigin}' is not allowed`))
			}
		},
		credentials: true,
	})
)
app.use(express.json())
app.use(cookieParser())

app.get("/", (_req: Request, res: Response) => {
	res.redirect("/docs")
})

app.use("/api", getUsersRoutes)
app.use("/api", loginRoutes)
app.use("/api", logoutRoutes)
app.use("/api", validateTokenRoutes)
app.use("/api", refreshTokenRoutes)

app.use("/api", createGameRoutes)
app.use("/api", fetchGamesRoutes)
app.use("/api", joinGameRoutes)
app.use("/api", leaveGameRoutes)
app.use("/api", loadGameRoutes)
app.use("/api", setGameStatusRoutes)

app.use("/docs", swaggerUi.serve)
app.get("/docs", swaggerUi.setup(swaggerSpec))

export default app
