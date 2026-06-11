import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

// https://vite.dev/config/
export default defineConfig({
	plugins: [react()],
	resolve: {
		tsconfigPaths: true
	},
	server: {
		port: 3004
	},
	build: {
		rollupOptions: {
			output: {
				manualChunks: (id) => {
					if (id.includes("node_modules")) {
						if (id.includes("react") || id.includes("react-dom") || id.includes("react-router") || id.includes("redux")) {
							return "vendor-react"
						}
						if (id.includes("@mui")) return "vendor-ui"
						if (id.includes("fortawesome")) return "vendor-icons"
						return "vendor-other"
					}
				}
			}
		},
		chunkSizeWarningLimit: 1000
	}
})
