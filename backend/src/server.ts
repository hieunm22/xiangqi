import app from "./app"

const PORT = Number(process.env.PORT) || 3000

app.listen(PORT, () => {
	console.log(`Chess API server is running on port ${PORT}`)
	console.log(`Swagger docs available at http://localhost:${PORT}/docs`)
})
