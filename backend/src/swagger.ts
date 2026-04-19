import swaggerJsdoc, { Options } from "swagger-jsdoc"

const options: Options = {
	definition: {
		openapi: "3.0.3",
		info: {
			title: "Chess API",
			version: "1.0.0",
			description: "Backend API documentation for Chess project"
		},
		servers: [
			{
				url: "http://localhost:5000",
				description: "Local development server"
			}
		]
	},
	apis: ["./src/routes/*.ts", "./dist/routes/*.js"]
}

const swaggerSpec = swaggerJsdoc(options)

export default swaggerSpec
