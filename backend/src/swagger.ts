import swaggerJsdoc, { Options } from "swagger-jsdoc"

const options: Options = {
	definition: {
		openapi: "3.0.3",
		info: {
			title: "Xiangqi API",
			version: "1.0.0",
			description: "Backend API documentation for Xiangqi project"
		},
		servers: [
			{
				url: "http://localhost:8000",
				description: "Local development server"
			}
		]
	},
	apis: [
		process.env.NODE_ENV === "production"
			? "./dist/routes/**/*.js"
			: "./src/routes/**/*.ts"
	]
}

const swaggerSpec = swaggerJsdoc(options)

export default swaggerSpec
