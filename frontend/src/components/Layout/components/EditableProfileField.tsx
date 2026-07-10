import { type KeyboardEvent, useEffect, useState } from "react"
import classnames from "classnames"
import { InputAdornment, TextField } from "@mui/material"
import { openAlert } from "components/AlertProvider/helper"
import { getToken } from "common/helper"
import { useAPI } from "hooks/useAPI"
import { useProfilePopup } from "hooks/useAppContext"
import { APIResponse } from "types/Common"
import { EditableProfileFieldProps, UpdateUserInfoResponse } from "../types"

export const EditableProfileField = (props: EditableProfileFieldProps) => {
	const {
		className,
		editable,
		extraActions,
		field,
		type,
		value,
		renderDisplay,
	} = props
	const { updateUserInfo } = useAPI()
	const { profileUser, setProfileUser } = useProfilePopup()
	const [draftValue, setDraftValue] = useState(value)
	const [isEditing, setIsEditing] = useState(false)
	const [isSaving, setIsSaving] = useState(false)

	useEffect(() => {
		setDraftValue(value)
		setIsEditing(false)
		setIsSaving(false)
	}, [value])

	useEffect(() => {
		if (!editable) {
			setIsEditing(false)
		}
	}, [editable])

	const handleSave = async () => {
		if (!editable) {
			return
		}

		if (isSaving) {
			return
		}

		const normalizedValue = value.trim()
		const nextValue = draftValue.trim()
		if (!nextValue) {
			setDraftValue(normalizedValue)
			setIsEditing(false)
			return
		}

		if (nextValue === normalizedValue) {
			setIsEditing(false)
			return
		}

		try {
			const token = getToken()
			if (!token) {
				await openAlert({
					title: "popup.alert.title",
					message: "Unauthorized"
				})
				return
			}

			setIsSaving(true)
			type Response = APIResponse<Partial<UpdateUserInfoResponse>>
			const response = await updateUserInfo(token, { [field]: nextValue }) as Response
			if (!response?.success) {
				await openAlert({
					title: "popup.alert.title",
					message: response?.message ?? "Failed to update user info"
				})
				return
			}

			if (profileUser) {
				setProfileUser({
					...profileUser,
					display_name: response.data.display_name ?? profileUser.display_name,
					email: response.data.email ?? profileUser.email,
				})
			}
		} finally {
			setIsSaving(false)
			setIsEditing(false)
		}
	}

	const handleRevert = () => {
		if (isSaving) {
			return
		}

		setDraftValue(value)
		setIsEditing(false)
	}

	const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
		if (event.key === "Enter") {
			event.preventDefault()
			event.stopPropagation()
			handleSave()
			return
		}

		if (event.key === "Escape") {
			event.preventDefault()
			event.stopPropagation()
			if (isSaving) {
				return
			}
			handleRevert()
		}
	}

	const saveButtonClass = classnames("pen-button", {
		"fas fa-spinner fa-pulse": isSaving,
		"fas fa-check": !isSaving,
	})

	if (isEditing) {
		return (
			<TextField
				type={type}
				size="small"
				autoFocus
				disabled={isSaving}
				fullWidth
				className="profile-inline-input"
				value={draftValue}
				variant="standard"
				onChange={e => setDraftValue(e.target.value)}
				onKeyDown={handleKeyDown}
				slotProps={{
					input: {
						endAdornment: (
							<InputAdornment position="end">
								<i className={saveButtonClass} onClick={handleSave} />
								{!isSaving && <i className="fas fa-times pen-button" onClick={handleRevert} />}
							</InputAdornment>
						),
					},
				}}
			/>
		)
	}

	return (
		<div className={className}>
			{renderDisplay ? renderDisplay(value) : <span>{value}</span>}
			{editable && <i className="fas fa-pen pen-button" onClick={() => setIsEditing(true)} />}
			{extraActions}
		</div>
	)
}
