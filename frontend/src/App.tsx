import { useMemo } from "react"
import { Route, Routes } from "react-router-dom"
import {
	createTheme,
	CssBaseline,
	ThemeProvider,
	type PaletteMode
} from "@mui/material"
import { LS_DARKMODE } from "common/constant"
import AlertProvider from "components/AlertProvider"
import ConfirmProvider from "components/ConfirmProvider"
import Layout from "components/Layout"
import LayoutUnAuth from "components/LayoutUnAuth"
import Dashboard from "pages/Dashboard"
import GamePage from "pages/Game"
import LoginPage from "pages/Login"
import LostPasswordPage from "pages/LostPassword"
import NotFoundPage from "pages/NotFound"
import RegisterPage from "pages/Register"
import useToolkit from "hooks/useToolkit"
import "App.scss"
import "styles/responsive.scss"
import "styles/common.scss"

function App() {
	const darkMode = localStorage.getItem(LS_DARKMODE) || "light"
	const { state } = useToolkit()

	const createThemeCallback = () =>
		createTheme({
			typography: {
				fontSize: 14
			},
			components: {
				MuiButton: {
					styleOverrides: {
						root: {
							textTransform: "none"
						}
					}
				},
				MuiInputBase: {
					styleOverrides: {
						root: {
							fontSize: "14px"
						}
					}
				},
				MuiListItemText: {
					styleOverrides: {
						primary: {
							fontSize: "14px"
						}
					}
				}
			},
			palette: {
				mode: darkMode as PaletteMode
			}
		})

	const theme = useMemo(createThemeCallback, [state.darkMode])

	const DashboardPageElement = (
		<ConfirmProvider>
			<AlertProvider>
				<Dashboard />
			</AlertProvider>
		</ConfirmProvider>
	)

	const GamePageElement = (
		<ConfirmProvider>
			<AlertProvider>
				<GamePage />
			</AlertProvider>
		</ConfirmProvider>
	)

	return (
		<ThemeProvider theme={theme}>
			<CssBaseline />
			<Routes>
				<Route element={<LayoutUnAuth />}>
					<Route path="/login" element={<LoginPage />} />
				</Route>
				<Route element={<LayoutUnAuth />}>
					<Route path="/lost-password" element={<LostPasswordPage />} />
				</Route>
				<Route element={<LayoutUnAuth />}>
					<Route path="/register" element={<RegisterPage />} />
				</Route>
				<Route element={<Layout />}>
					<Route path="/dashboard" element={DashboardPageElement} />
				</Route>
				<Route element={<Layout />}>
					<Route path="/" element={GamePageElement} />
				</Route>
			<Route path="*" element={<NotFoundPage />} />
		</Routes>
		</ThemeProvider>
	)
}

export default App
