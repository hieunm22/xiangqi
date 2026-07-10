import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
// import checker from "vite-plugin-checker"

// https://vite.dev/config/
export default defineConfig({
	plugins: [
		react(),
		// checker({
		// 	overlay: false,
		// 	eslint: {
		// 		useFlatConfig: true,
		// 		lintCommand: 'eslint "./src/**/*.{ts,tsx}"',
		// 		dev: {
		// 			logLevel: [
		// 				"error",
		// 				"warning"
		// 			]
		// 		}
		// 	}
		// })
	],
	resolve: {
		tsconfigPaths: true
	},
  server: {
    host: '0.0.0.0',  // or '127.0.0.1' if only localhost
    port: 3004
	},
	build: {
		rollupOptions: {
			output: {
				manualChunks: (id) => {
					if (id.includes("node_modules")) {
						// eslint-disable-next-line max-len
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
