import { ChangeEvent, useState } from "react"
import { useNavigate } from "react-router-dom"
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
import { betOptions } from "../constants"
import Alert from "components/AlertWithIcon"
import { TButton, TTextField } from "components/TranslationTag"
import { PieceSelection } from "./PieceSelection"
import { translate } from "locales/translate"
import { getToken } from "common/helper"
import { PieceSelectionContext, useCreateRoomDialogContext } from "hooks/useAppContext"
import { useAPI } from "hooks/useAPI"
import { APIResponse } from "types/Common"
import { Team } from "types/GameState"
import { RoomWithUsers } from "pages/Room/types"
import { CreateRoomRequest } from "../types"

export const CreateRoomDialog = () => {
	const { open, setOpen } = useCreateRoomDialogContext()
	const { createRoom } = useAPI()
	const [roomName, setRoomName] = useState("")
	const [roomNameError, setRoomNameError] = useState(false)
	const [isRedFirst, setIsRedFirst] = useState(true)
	const [pveMode, setPveMode] = useState(false)
	const [betAmount, setBetAmount] = useState(10)
	const [oldBetAmount, setOldBetAmount] = useState(10)
	const [selectedColor, setSelectedColor] = useState<Team>("red")
	const [submitting, setSubmitting] = useState(false)
	const [submitError, setSubmitError] = useState("")
	const botBetOptions = [0]

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

	const onSwitchChanged = (e: ChangeEvent<HTMLInputElement>) => {
		const checked = e.target.checked
		setPveMode(checked)
		setOldBetAmount(betAmount)
		setBetAmount(checked ? 0 : oldBetAmount)
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
			pveMode,
			betAmount: pveMode ? 0 : betAmount
		}
		const response = await createRoom(token, body) as APIResponse<RoomWithUsers>

		setSubmitting(false)

		if (!response?.success) {
			setSubmitError(response?.message || translate("dashboard.feedback.error"))
			return
		}

		const createdRoomId = Number(response?.data?.room?.id)
		if (!Number.isInteger(createdRoomId) || createdRoomId <= 0) {
			setSubmitError(translate("dashboard.feedback.error"))
			return
		}

		handleClose(null, "escapeKeyDown")
		// navigate to the newly created room page
		navigate(`/room/${createdRoomId}`)
	}

	const handleClose = (_: any, reason?: "backdropClick" | "escapeKeyDown") => {
		if (reason === "backdropClick") return
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
				<Stack spacing={2}>
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

					<FormControlLabel
						sx={{ ml: 0, mr: 0, alignSelf: "flex-start" }}
						control={
							<Switch
								className="ios-switch pve-mode"
								checked={pveMode}
								onChange={onSwitchChanged}
							/>
						}
						label={translate("dashboard.popup.pve-mode")}
					/>

					<FormControl fullWidth size="small">
						<FormLabel>{translate("dashboard.popup.bet-amount")}</FormLabel>
							<Select
								value={betAmount}
								disabled={pveMode}
								onChange={e => setBetAmount(Number(e.target.value))}
							>
								{(pveMode ? botBetOptions : betOptions).map(option => (
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
