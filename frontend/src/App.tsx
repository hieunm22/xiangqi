import { lazy, Suspense, useMemo } from "react"
import { Route, Routes, useParams } from "react-router-dom"
import {
	createTheme,
	CssBaseline,
	ThemeProvider,
	type PaletteMode
} from "@mui/material"
import { HOME_PATH, LOGIN_PATH, LS_DARKMODE } from "common/constant"
import AlertProvider from "components/AlertProvider"
import SnackbarProvider from "components/SnackbarProvider"
import { AuthProvider } from "components/AuthProvider"
import ConfirmProvider from "components/ConfirmProvider"
import Layout from "components/Layout"
import LayoutUnAuth from "components/LayoutUnAuth"
import PageLoader from "components/PageLoader"
import { ProtectedRoute } from "components/ProtectedRoute"
import { SocketProvider } from "hooks/SocketProvider"
import useToolkit from "hooks/useToolkit"
import "App.scss"
import "styles/animation.scss"
// always import these scss files after App.scss to override the styles
import "pages/Announce/Announce.scss"
import "pages/Dashboard/Dashboard.scss"
import "pages/ExtraMoney/ExtraMoney.scss"
import "pages/Leaderboard/Leaderboard.scss"
import "pages/Login/Login.scss"
import "pages/LostPassword/LostPassword.scss"
import "pages/NotFound/NotFound.scss"
import "pages/Register/Register.scss"
import "pages/ResetPassword/ResetPassword.scss"
import "pages/Room/Room.scss"
import "styles/responsive.scss"
import "styles/mui.scss"
import "styles/common.scss"

const AnnouncePage = lazy(() => import("pages/Announce"))
const Dashboard = lazy(() => import("pages/Dashboard"))
const ExtraMoneyPage = lazy(() => import("pages/ExtraMoney"))
const LeaderboardPage = lazy(() => import("pages/Leaderboard"))
const LoginPage = lazy(() => import("pages/Login"))
const LostPasswordPage = lazy(() => import("pages/LostPassword"))
const NotFoundPage = lazy(() => import("pages/NotFound"))
const RegisterPage = lazy(() => import("pages/Register"))
const ResetPasswordPage = lazy(() => import("pages/ResetPassword"))
const RoomPage = lazy(() => import("pages/Room"))

const RoomPageElement = () => {
	const { id } = useParams()
	return (
		<SnackbarProvider>
			<ConfirmProvider>
				<AlertProvider>
					<RoomPage key={id} />
				</AlertProvider>
			</ConfirmProvider>
		</SnackbarProvider>
	)
}

function AppWithTheme() {
	const darkMode = localStorage.getItem(LS_DARKMODE) || "light"
	const { state } = useToolkit()

	const theme = useMemo(() =>
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
		}), [state.darkMode])

	const DashboardPageElement = (
		<ConfirmProvider>
			<AlertProvider>
				<Dashboard />
			</AlertProvider>
		</ConfirmProvider>
	)

	return (
		<ThemeProvider theme={theme}>
			<CssBaseline />
			<Suspense fallback={<PageLoader />}>
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
					<Route
						element={
							<ProtectedRoute>
								<SocketProvider>
									<Layout />
								</SocketProvider>
							</ProtectedRoute>
						}
					>
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
									<RoomPageElement />
								</ProtectedRoute>
							}
						/>
						<Route
							path="/announce"
							element={
								<ProtectedRoute>
									<AnnouncePage />
								</ProtectedRoute>
							}
						/>
						<Route
							path="/extra-money"
							element={
								<ProtectedRoute>
									<ExtraMoneyPage />
								</ProtectedRoute>
							}
						/>
						<Route
							path="/leaderboard"
							element={
								<ProtectedRoute>
									<LeaderboardPage />
								</ProtectedRoute>
							}
						/>
					</Route>
					<Route path="*" element={<NotFoundPage />} />
				</Routes>
			</Suspense>
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
