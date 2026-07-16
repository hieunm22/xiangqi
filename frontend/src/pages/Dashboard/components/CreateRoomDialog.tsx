import { ChangeEvent, useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
	Stack,
	CircularProgress,
	DialogActions,
	DialogContent,
	DialogTitle,
	FormControl,
	FormControlLabel,
	FormLabel,
	MenuItem,
	Select,
	Switch,
} from "@mui/material"
import { betOptions } from "../constants"
import Alert from "components/AlertWithIcon"
import { ResponsiveDialog } from "components/ResponsiveDialog"
import { TButton, TTextField, TTooltip } from "components/TranslationTag"
import { PieceSelection } from "./PieceSelection"
import { translate } from "locales/translate"
import { getToken } from "common/helper"
import {
	PieceSelectionContext,
	useCreateRoomDialogContext,
	useProfilePopup
} from "hooks/useAppContext"
import { useAPI } from "hooks/useAPI"
import { APIResponse } from "types/Common"
import { Team } from "types/GameState"
import { RoomWithUsers } from "pages/Room/types"
import { CreateRoomRequest } from "../types"

// Default bet when the dialog opens, based on the user's total amount
const pickDefaultBet = (total: number) => {
	const atOrBelowThreshold = betOptions.filter(option => option * 5 <= total)
	if (atOrBelowThreshold.length > 0) {
		return atOrBelowThreshold[atOrBelowThreshold.length - 1]
	}
	const affordable = betOptions.filter(option => option * 10 <= total * 8)
	return affordable.length > 0 ? affordable[0] : betOptions[0]
}

export const CreateRoomDialog = () => {
	const { open, setOpen } = useCreateRoomDialogContext()
	const { createRoom } = useAPI()
	const [roomName, setRoomName] = useState("")
	const [roomNameError, setRoomNameError] = useState(false)
	const [isRedFirst, setIsRedFirst] = useState(true)
	const [pveMode, setPveMode] = useState(false)
	const [betAmount, setBetAmount] = useState(10)
	const [oldBetAmount, setOldBetAmount] = useState(10)
	// 0 = no time limit; otherwise total seconds per player.
	const [timeLimit, setTimeLimit] = useState(0)
	const [timeIncrement, setTimeIncrement] = useState(0)
	const [timePerMove, setTimePerMove] = useState(0)
	const [selectedColor, setSelectedColor] = useState<Team>("red")
	const [submitting, setSubmitting] = useState(false)
	const [submitError, setSubmitError] = useState("")
	const botBetOptions = [0]

	const { currentUser } = useProfilePopup()
	const isBalanceLoaded = currentUser != null
	const totalAmount = currentUser?.total_amount ?? 0
	const canAffordBet = (option: number) => option === 0 || option * 10 <= totalAmount * 8

	// Auto-pick the default bet only on the open transition.
	const defaultAppliedRef = useRef(false)
	useEffect(() => {
		if (!open) {
			defaultAppliedRef.current = false
			return
		}
		if (pveMode || defaultAppliedRef.current || !isBalanceLoaded) {
			return
		}
		defaultAppliedRef.current = true
		setBetAmount(pickDefaultBet(totalAmount))
	}, [open, pveMode, isBalanceLoaded, totalAmount])

	const isRoomNameEmpty = roomName.trim().length === 0
	const navigate = useNavigate()

	const resetForm = () => {
		setRoomName("")
		setRoomNameError(false)
		setIsRedFirst(true)
		setBetAmount(10)
		setTimeLimit(0)
		setTimeIncrement(0)
		setTimePerMove(0)
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

	const formatBetAmount = (amount: number) => (amount >= 1000 ? `${amount / 1000}k` : amount)

	// 0 = unlimited; other values are total seconds per player (5-10-15-20-30-60 min).
	const timeLimitOptions = [0, 300, 600, 900, 1200, 1800, 3600]
	const formatTimeLimit = (seconds: number) =>
		seconds === 0
			? translate("dashboard.popup.time-unlimited")
			: translate("dashboard.popup.time-minutes").format(seconds / 60)

	// Add-ons (seconds); 0 = off. Disabled unless a total time limit is set.
	const timeIncrementOptions = [0, 3, 5, 15, 30, 60, 90]
	const timePerMoveOptions = [0, 30, 60, 90, 120, 180]
	const formatSeconds = (seconds: number) =>
		seconds === 0
			? translate("dashboard.popup.time-off")
			: translate("dashboard.popup.time-seconds").format(seconds)
	const addOnsDisabled = pveMode || timeLimit === 0

	// Compact glyphs shown as the collapsed selected value (the dropdown menus
	// still list the full descriptive labels). Keeps the 3 selects on one row.
	const compactTimeLimit = (seconds: number) => (seconds === 0 ? "∞" : `${seconds / 60}m`)
	const compactSeconds = (seconds: number) => (seconds === 0 ? "–" : `${seconds}s`)
	// Inline (dialog renders in a portal, so page SCSS may not reach it).
	const timeValueStyle = { display: "inline-flex", alignItems: "center", gap: 6 }

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
			betAmount: pveMode ? 0 : betAmount,
			timeLimit: pveMode ? null : timeLimit || null,
			timeIncrement: addOnsDisabled ? 0 : timeIncrement,
			timePerMove: addOnsDisabled ? 0 : timePerMove,
		}
		const response = (await createRoom(token, body)) as APIResponse<RoomWithUsers>

		setSubmitting(false)

		if (!response?.success) {
			setSubmitError(response?.message || "dashboard.feedback.error")
			return
		}

		const createdRoomId = Number(response?.data?.room?.id)
		if (!Number.isInteger(createdRoomId) || createdRoomId <= 0) {
			setSubmitError("dashboard.feedback.error")
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

		<ResponsiveDialog
			drawerAnchor="bottom"
			open={open}
			onClose={handleClose}
			fullWidth
			maxWidth="sm"
			slotProps={{
				paper: {
					className: "dashboard__create-room-dialog-paper"
				}
			}}
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

					<Stack direction="row" spacing={1}>
						<FormControlLabel
							sx={{ ml: 0, mr: 0, alignSelf: "flex-start" }}
							label={translate("dashboard.popup.red-first")}
							control={
								<Switch
									className="ios-switch red-first"
									checked={isRedFirst}
									onChange={event => setIsRedFirst(event.target.checked)}
								/>
							}
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
					</Stack>

					<FormControl size="small">
						<FormLabel>{translate("dashboard.popup.bet-amount")}</FormLabel>
						<Select
							value={betAmount}
							disabled={pveMode || !isBalanceLoaded}
							onChange={e => setBetAmount(Number(e.target.value))}
							renderValue={value => (!pveMode && !isBalanceLoaded
								? <CircularProgress size={16} />
								: formatBetAmount(Number(value)))}
						>
							{(pveMode ? botBetOptions : betOptions).map(option => (
								<MenuItem key={option} value={option} disabled={!canAffordBet(option)}>
									{formatBetAmount(option)}
								</MenuItem>
							))}
						</Select>
					</FormControl>

					<FormLabel>{translate("dashboard.popup.time-limit")}</FormLabel>
					<Stack direction="row" spacing={1} className="mt-8">
						<TTooltip title="dashboard.popup.time-limit-per-player" arrow>
							<FormControl fullWidth size="small">
								<Select
									value={pveMode ? 0 : timeLimit}
									disabled={pveMode}
									onChange={e => setTimeLimit(Number(e.target.value))}
									renderValue={value => (
										<span style={timeValueStyle}>
											<i className="far fa-clock" />
											{compactTimeLimit(Number(value))}
										</span>
									)}
								>
									{timeLimitOptions.map(option => (
										<MenuItem key={option} value={option}>{formatTimeLimit(option)}</MenuItem>
									))}
								</Select>
							</FormControl>
						</TTooltip>

						<TTooltip title="dashboard.popup.time-increment" arrow>
							<FormControl fullWidth size="small">
								<Select
									value={addOnsDisabled ? 0 : timeIncrement}
									disabled={addOnsDisabled}
									onChange={e => setTimeIncrement(Number(e.target.value))}
									renderValue={value => (
										<span style={timeValueStyle}>
											<i className="far fa-circle-plus" />
											{compactSeconds(Number(value))}
										</span>
									)}
								>
									{timeIncrementOptions.map(option => (
										<MenuItem key={option} value={option}>{formatSeconds(option)}</MenuItem>
									))}
								</Select>
							</FormControl>
						</TTooltip>

						<TTooltip title="dashboard.popup.time-per-move" arrow>
							<FormControl fullWidth size="small">
								<Select
									value={addOnsDisabled ? 0 : timePerMove}
									disabled={addOnsDisabled}
									onChange={e => setTimePerMove(Number(e.target.value))}
									renderValue={value => (
										<span style={timeValueStyle}>
											<i className="far fa-stopwatch" />
											{compactSeconds(Number(value))}
										</span>
									)}
								>
									{timePerMoveOptions.map(option => (
										<MenuItem key={option} value={option}>{formatSeconds(option)}</MenuItem>
									))}
								</Select>
							</FormControl>
						</TTooltip>
					</Stack>
				</Stack>
			</DialogContent>
			<DialogActions sx={{ p: 2 }}>
				<TButton
					variant="contained"
					onClick={handleCreateRoom}
					disabled={isRoomNameEmpty || submitting || !canAffordBet(betAmount)}
					value="popup.confirm.ok"
				/>
				<TButton
					variant="outlined"
					onClick={handleClose}
					disabled={submitting}
					value="popup.confirm.cancel"
				/>
			</DialogActions>
		</ResponsiveDialog>
	)
}
