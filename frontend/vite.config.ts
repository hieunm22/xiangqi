import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tsconfigPaths from "vite-tsconfig-paths"

// https://vite.dev/config/
export default defineConfig({
	plugins: [react(), tsconfigPaths()],
	server: {
		port: 3004
	},
	build: {
		rollupOptions: {
			output: {
				manualChunks: {
					"vendor-react": ["react", "react-dom", "react-router-dom", "react-redux", "@reduxjs/toolkit"],
					"vendor-ui": ["@mui/material"],
					"vendor-icons": ["@fortawesome/fontawesome-pro"],
					"vendor-other": ["i18next", "react-i18next", "socket.io-client", "wretch", "classnames", "styled-components"]
				}
			}
		},
		chunkSizeWarningLimit: 1000
	}
})
