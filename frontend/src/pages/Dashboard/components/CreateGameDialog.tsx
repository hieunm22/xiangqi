import { createContext, useContext, useState } from "react"
import {
	Alert,
	Stack,
	Dialog,
	DialogTitle,
	DialogContent,
	FormControl,
	FormLabel,
	FormControlLabel,
	Switch,
	Select,
	MenuItem,
	DialogActions
} from "@mui/material"
import { TButton, TTextField } from "components/TranslationTag"
import { PieceSelection, PieceSelectionContext } from "./PieceSelection"
import { translate } from "locales/translate"
import { getToken } from "common/helper"
import { useAPI } from "hooks/useAPI"
import { Team } from "types/GameState"
import { CreateGameContextValue, CreateGameRequest } from "../types"
import { useNavigate } from "react-router-dom"

export const CreateGameDialogContext = createContext<CreateGameContextValue | null>(null)

const useCreateGameDialogContext = () => {
	const context = useContext(CreateGameDialogContext)

	if (!context) {
		throw new Error("CreateGameDialog must be used within CreateGameDialogContext.Provider")
	}

	return context
}

export const CreateGameDialog = () => {
	const { open, setOpen } = useCreateGameDialogContext()
	const { createGame } = useAPI()
	const [gameName, setGameName] = useState("")
	const [gameNameError, setGameNameError] = useState(false)
	const [isRedFirst, setIsRedFirst] = useState(true)
	const [betAmount, setBetAmount] = useState(10)
	const [selectedColor, setSelectedColor] = useState<Team>("red")
	const [submitting, setSubmitting] = useState(false)
	const [submitError, setSubmitError] = useState("")
	const betOptions = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000]
	const isGameNameEmpty = gameName.trim().length === 0
	const navigate = useNavigate()

	const resetForm = () => {
		setGameName("")
		setGameNameError(false)
		setIsRedFirst(true)
		setBetAmount(10)
		setSelectedColor("red")
		setSubmitting(false)
		setSubmitError("")
	}

	const handleGameNameBlur = () => {
		setGameNameError(gameName.trim().length === 0)
	}

	const formatBetAmount = (amount: number) => amount >= 1000 ? `${amount / 1000}k` : amount

	const handleCreateGame = async () => {
		if (isGameNameEmpty || submitting) {
			return
		}

		setSubmitting(true)
		setSubmitError("")

		const token = getToken()
		const body: CreateGameRequest = {
			tableName: gameName.trim(),
			teamName: selectedColor,
			redFirst: isRedFirst,
			betAmount
		}
		const response = await createGame(token, body)

		setSubmitting(false)

		if (!response?.success) {
			setSubmitError(response?.message || translate("dashboard.feedback.error"))
			return
		}

		handleClose()
		// navigate to the newly created game page
		navigate(`/game/${response.gameId}`)
	}

	const handleClose = () => {
		setOpen(false)
		resetForm()
	}

	return (

		<Dialog
			open={open}
			onClose={handleClose}
			fullWidth
			maxWidth="sm"
		>
			<DialogTitle>{translate("dashboard.popup.title")}</DialogTitle>
			<DialogContent>
				<Stack spacing={2} sx={{ pt: 1 }}>
					{submitError && <Alert severity="error">{submitError}</Alert>}
					<TTextField
						fullWidth
						size="small"
						variant="standard"
						required
						autoFocus
						label="dashboard.popup.game-name-label"
						value={gameName}
						onChange={event => setGameName(event.target.value)}
						onBlur={handleGameNameBlur}
						error={gameNameError}
						helperText={gameNameError ? "dashboard.popup.game-name-helptext" : " "}
					/>

					<FormControl>
						<FormLabel>{translate("dashboard.popup.piece-selection")}</FormLabel>
						<PieceSelectionContext.Provider value={{ selectedColor, setSelectedColor }}>
							<PieceSelection />
						</PieceSelectionContext.Provider>
					</FormControl>

					<FormControlLabel
						sx={{ ml: 0, mr: 0, alignSelf: "flex-start" }}
						control={
							<Switch
								className="ios-switch red-first"
								checked={isRedFirst}
								onChange={event => setIsRedFirst(event.target.checked)}
							/>
						}
						label={translate("dashboard.popup.red-first")}
					/>

					<FormControl fullWidth size="small">
						<FormLabel>{translate("dashboard.popup.bet-amount")}</FormLabel>
						<Select
							value={betAmount}
							onChange={event => setBetAmount(Number(event.target.value))}
						>
							{betOptions.map(option => (
								<MenuItem key={option} value={option}>{formatBetAmount(option)}</MenuItem>
							))}
						</Select>
					</FormControl>
				</Stack>
			</DialogContent>
			<DialogActions sx={{ px: 3, pb: 2 }}>
				<TButton
					variant="contained"
					onClick={handleCreateGame}
					disabled={isGameNameEmpty || submitting}
					value="popup.confirm.ok"
				/>
				<TButton
					onClick={handleClose}
					disabled={submitting}
					value="popup.confirm.cancel"
				/>
			</DialogActions>
		</Dialog>
	)
}
