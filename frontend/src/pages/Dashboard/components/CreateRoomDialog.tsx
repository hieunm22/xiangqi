import { createContext, useContext, useState } from "react"
import {
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
import Alert from "components/AlertWithIcon"
import { TButton, TTextField } from "components/TranslationTag"
import { PieceSelection, PieceSelectionContext } from "./PieceSelection"
import { translate } from "locales/translate"
import { getToken } from "common/helper"
import { useAPI } from "hooks/useAPI"
import { Team } from "types/GameState"
import { CreateRoomContextValue, CreateRoomRequest } from "../types"
import { useNavigate } from "react-router-dom"

export const CreateRoomDialogContext = createContext<CreateRoomContextValue | null>(null)

const useCreateRoomDialogContext = () => {
	const context = useContext(CreateRoomDialogContext)

	if (!context) {
		throw new Error("CreateRoomDialog must be used within CreateRoomDialogContext.Provider")
	}

	return context
}

export const CreateRoomDialog = () => {
	const { open, setOpen } = useCreateRoomDialogContext()
	const { createRoom } = useAPI()
	const [roomName, setRoomName] = useState("")
	const [roomNameError, setRoomNameError] = useState(false)
	const [isRedFirst, setIsRedFirst] = useState(true)
	const [betAmount, setBetAmount] = useState(10)
	const [selectedColor, setSelectedColor] = useState<Team>("red")
	const [submitting, setSubmitting] = useState(false)
	const [submitError, setSubmitError] = useState("")
	const betOptions = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000]
	const isRoomNameEmpty = roomName.trim().length === 0
	const navigate = useNavigate()

	const resetForm = () => {
		setRoomName("")
		setRoomNameError(false)
		setIsRedFirst(true)
		setBetAmount(10)
		setSelectedColor("red")
		setSubmitting(false)
		setSubmitError("")
	}

	const handleRoomNameBlur = () => {
		setRoomNameError(roomName.trim().length === 0)
	}

	const formatBetAmount = (amount: number) => amount >= 1000 ? `${amount / 1000}k` : amount

	const handleCreateRoom = async () => {
		if (isRoomNameEmpty || submitting) {
			return
		}

		setSubmitting(true)
		setSubmitError("")

		const token = getToken()
		const body: CreateRoomRequest = {
			tableName: roomName.trim(),
			teamName: selectedColor,
			redFirst: isRedFirst,
			betAmount
		}
		const response = await createRoom(token, body)

		setSubmitting(false)

		if (!response?.success) {
			setSubmitError(response?.message || translate("dashboard.feedback.error"))
			return
		}

		const createdRoomId = Number(response?.room?.id ?? response?.gameId)
		if (!Number.isInteger(createdRoomId) || createdRoomId <= 0) {
			setSubmitError(translate("dashboard.feedback.error"))
			return
		}

		handleClose()
		// navigate to the newly created room page
		navigate(`/room/${createdRoomId}`)
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
			<DialogTitle>{translate("dashboard.room.create")}</DialogTitle>
			<DialogContent>
				<Stack spacing={2} sx={{ pt: 1 }}>
					{submitError && <Alert severity="error">{submitError}</Alert>}
					<TTextField
						fullWidth
						size="small"
						variant="standard"
						required
						autoFocus
						label="dashboard.popup.room-name-label"
						value={roomName}
						onChange={event => setRoomName(event.target.value)}
						onBlur={handleRoomNameBlur}
						error={roomNameError}
						helperText={roomNameError ? "dashboard.popup.room-name-helptext" : " "}
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
					onClick={handleCreateRoom}
					disabled={isRoomNameEmpty || submitting}
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
