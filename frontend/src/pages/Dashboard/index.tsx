// generate a page with Hello World text
import { useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { getToken, initNewGame } from "common/helper"
import useAutoTitle from "hooks/useAutoTitle"
import useGameToolkit from "hooks/useGameToolkit"
import { setGameState } from "toolkit/slice/game"

const DashboardPage = () => {
	useAutoTitle("dashboard.page.title")
	const { dispatch } = useGameToolkit()
	const navigate = useNavigate()

	useEffect(() => {
		const token = getToken()
		if (!token) {
			navigate("/login")
			return
		}

		// Initialize game state when entering dashboard
		const init = initNewGame()
		dispatch(setGameState(init))
	}, [dispatch, navigate])

	return (
		<div>
			<h1>Dashboard</h1>
			<p>Welcome to the dashboard!</p>
		</div>
	)
}

export default DashboardPage
