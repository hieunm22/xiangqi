import js from "@eslint/js"
import globals from "globals"
import reactHooks from "eslint-plugin-react-hooks"
import reactRefresh from "eslint-plugin-react-refresh"
import tseslint from "typescript-eslint"
import { defineConfig, globalIgnores } from "eslint/config"

export default defineConfig([
  globalIgnores(["dist"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      "@typescript-eslint/no-unused-vars": "warn",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/immutability": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "react-hooks/exhaustive-deps": "off",
      "@typescript-eslint/no-unused-expressions": "off",
      "no-case-declarations": "off",
      "max-len": ["warn", { code: 100, tabWidth: 2, ignoreUrls: true }],
      "no-console": "warn",
    },
  },
  // Per-file rule overrides
  {
    files: [
      "src/common/browser.ts",
      "src/common/helper.ts",
      "src/hooks/useAPI.ts",
      "src/hooks/useSocket.tsx",
      "src/**/constant*.ts",
    ],
    rules: {
      "max-len": "off",
    },
  },
])
