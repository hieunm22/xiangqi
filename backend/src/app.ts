import cors from "cors"
import express, { Request, Response } from "express"
import swaggerUi from "swagger-ui-express"

import healthRoutes from "./routes/health"
import swaggerSpec from "./swagger"

const app = express()

app.use(cors())
app.use(express.json())

app.get("/", (_req: Request, res: Response) => {
	res.json({
		success: true,
		message: "Welcome to Chess API",
		docs: "/docs"
	})
})

app.use("/api", healthRoutes)
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec))

export default app
