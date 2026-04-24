import cors from "cors"
import express, { Request, Response } from "express"
import swaggerUi from "swagger-ui-express"

import healthRoutes from "./routes/health"
import swaggerSpec from "./swagger"

import authRoutes from "./routes/auth"

const app = express()

app.use(cors())
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
