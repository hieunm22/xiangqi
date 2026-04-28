import cors from "cors"
import express, { Request, Response } from "express"
import swaggerUi from "swagger-ui-express"

import healthRoutes from "./routes/health"
import swaggerSpec from "./swagger"

import authRoutes from "./routes/auth"

const app = express()

const rawOrigins = process.env.CORS_ORIGINS ?? "http://localhost:3001"
const allowedOrigins = rawOrigins.split(",").map((o) => o.trim()).filter(Boolean)

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

app.use("/api", healthRoutes)
app.use("/api", authRoutes)

app.get("/", (_req: Request, res: Response) => {
	res.json({
		success: true,
		message: "Welcome to Xiangqi API",
		docs: "/docs"
	})
})

app.use("/api", healthRoutes)
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec))

export default app
