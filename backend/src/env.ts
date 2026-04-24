import fs from "fs"
import path from "path"
import dotenv from "dotenv"

const envFiles = [".env.local", ".env.backend", ".env"]
const loadedFiles: string[] = []

for (const envFile of envFiles) {
	const fullPath = path.resolve(process.cwd(), envFile)
	if (!fs.existsSync(fullPath)) {
		continue
	}

	const result = dotenv.config({ path: fullPath, override: false })
	if (!result.error) {
		loadedFiles.push(envFile)
	}
}

const requiredEnv = ["DATABASE_URL", "JWT_SECRET", "JWT_REFRESH_SECRET"]
const missingEnv = requiredEnv.filter((key) => !process.env[key]?.trim())

if (missingEnv.length > 0) {
	const loadedFrom = loadedFiles.length > 0 ? loadedFiles.join(", ") : "no env file"
	throw new Error(
		`Missing required environment variables: ${missingEnv.join(", ")}. Loaded from: ${loadedFrom}`
	)
}
