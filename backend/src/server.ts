import "./env"
import { execSync } from "child_process"
import { createHash } from "crypto"
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs"
import path from "path"
import app from "./app"

const PORT = Number(process.env.PORT) || 8000

// Paths — resolve schema reliably in both ts-node (src) and compiled dist environments.
const schemaPath = path.resolve(__dirname, "../prisma/schema.prisma")
const dbDir =
	process.env.DATABASE_DIR ??
	(existsSync(path.resolve(process.cwd(), "../database"))
		? path.resolve(process.cwd(), "../database")
		: path.resolve(process.cwd(), "database"))
const hashPath = path.join(dbDir, "schema.hash")

function getSchemaHash(): string {
	const content = readFileSync(schemaPath, "utf-8")
	return createHash("sha256").update(content).digest("hex")
}

const currentHash = getSchemaHash()
const savedHash = existsSync(hashPath) ? readFileSync(hashPath, "utf-8").trim() : ""

if (currentHash !== savedHash) {
	console.log("Schema change detected, running database migrations...")
	try {
		execSync("npx prisma migrate deploy", { stdio: "inherit" })
		mkdirSync(dbDir, { recursive: true })
		writeFileSync(hashPath, currentHash, "utf-8")
		console.log("Migrations applied successfully.")
	} catch (err) {
		console.error("Migration failed, server will not start.", err)
		process.exit(1)
	}
} else {
	console.log("Schema unchanged, skipping migrations.")
}

app.listen(PORT, () => {
	console.log(`Xiangqi API server is running on port ${PORT}`)
	console.log(`Swagger docs available at http://localhost:${PORT}/docs`)
})
