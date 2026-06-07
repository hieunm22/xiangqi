import { useMemo } from "react"
import { Route, Routes } from "react-router-dom"
import {
	createTheme,
	CssBaseline,
	ThemeProvider,
	type PaletteMode
} from "@mui/material"
import { HOME_PATH, LOGIN_PATH, LS_DARKMODE } from "common/constant"
import AlertProvider from "components/AlertProvider"
import { AuthProvider } from "components/AuthProvider"
import BotDifficultyProvider from "components/BotDifficultyProvider"
import ConfirmProvider from "components/ConfirmProvider"
import Dashboard from "pages/Dashboard"
import Layout from "components/Layout"
import LayoutUnAuth from "components/LayoutUnAuth"
import LoginPage from "pages/Login"
import LostPasswordPage from "pages/LostPassword"
import NotFoundPage from "pages/NotFound"
import { ProtectedRoute } from "components/ProtectedRoute"
import RegisterPage from "pages/Register"
import ResetPasswordPage from "pages/ResetPassword"
import RoomPage from "pages/Room"
import useToolkit from "hooks/useToolkit"
import "App.scss"
import "styles/responsive.scss"
import "styles/common.scss"

function AppWithTheme() {
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

	const RoomPageElement = (
		<ConfirmProvider>
			<AlertProvider>
				<BotDifficultyProvider>
					<RoomPage />
				</BotDifficultyProvider>
			</AlertProvider>
		</ConfirmProvider>
	)

	return (
		<ThemeProvider theme={theme}>
			<CssBaseline />
			<Routes>
				<Route element={<LayoutUnAuth />}>
					<Route
						path={LOGIN_PATH}
						element={
							<ProtectedRoute isPublicPage>
								<LoginPage />
							</ProtectedRoute>
						}
					/>
					<Route
						path="/lost-password"
						element={
							<ProtectedRoute isPublicPage>
								<LostPasswordPage />
							</ProtectedRoute>
						}
					/>
					<Route
						path="/reset-password"
						element={
							<ProtectedRoute isPublicPage>
								<ResetPasswordPage />
							</ProtectedRoute>
						}
					/>
					<Route
						path="/register"
						element={
							<ProtectedRoute isPublicPage>
								<RegisterPage />
							</ProtectedRoute>
						}
					/>
				</Route>
				<Route element={<Layout />}>
					<Route
						path={HOME_PATH}
						element={
							<ProtectedRoute>
								{DashboardPageElement}
							</ProtectedRoute>
						}
					/>
					<Route
						path="/room/:id"
						element={
							<ProtectedRoute>
								{RoomPageElement}
							</ProtectedRoute>
						}
					/>
				</Route>
				<Route path="*" element={<NotFoundPage />} />
			</Routes>
		</ThemeProvider>
	)
}

const App = () => {
	return (
		<AuthProvider>
			<AppWithTheme />
		</AuthProvider>
	)
}

export default App
