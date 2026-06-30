import { defineConfig } from "vitest/config"
import path from "path"

export default defineConfig({
	resolve: {
		alias: {
			common: path.resolve(__dirname, "src/common"),
			job: path.resolve(__dirname, "src/job"),
			middleware: path.resolve(__dirname, "src/middleware"),
			prisma: path.resolve(__dirname, "src/prisma"),
			routes: path.resolve(__dirname, "src/routes"),
			templates: path.resolve(__dirname, "src/templates"),
			types: path.resolve(__dirname, "src/types")
		}
	},
	test: {
		environment: "node",
		include: ["src/**/*.test.ts"],
		clearMocks: true,
		restoreMocks: true,
		reporters: ["tree"]
	}
})
