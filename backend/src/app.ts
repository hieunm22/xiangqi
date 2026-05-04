import express, { Request, Response } from "express"
import swaggerUi from "swagger-ui-express"
import swaggerSpec from "./swagger"
import cors from "cors"
import cookieParser from "cookie-parser"

import authRoutes from "./routes/auth/login"
import validateTokenRoutes from "./routes/auth/validate-token"
import refreshTokenRoutes from "./routes/auth/refresh-token"
import logoutRoutes from "./routes/auth/logout"

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

app.use("/api", authRoutes)
app.use("/api", validateTokenRoutes)
app.use("/api", refreshTokenRoutes)
app.use("/api", logoutRoutes)

app.use("/docs", swaggerUi.serve)
app.get("/docs", swaggerUi.setup(swaggerSpec))

export default app
