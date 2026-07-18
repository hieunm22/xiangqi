import { useEffect, useRef, useState } from "react"
import {
	Box,
	CircularProgress,
	Dialog,
	DialogActions,
	DialogContent,
	DialogTitle,
	Divider,
	List,
	ListItem,
	ListItemButton,
	Typography,
} from "@mui/material"
import { PopupState } from "common/enums"
import { TButton, TTextField, TTypography } from "components/TranslationTag"
import { formatNumber, getClaimsFromLocalStorage, getToken } from "common/helper"
import { UserAvatar } from "pages/Dashboard/components/UserAvatar"
import { ClaimIconButton } from "pages/ExtraMoney/components/Icons"
import { useAPI } from "hooks/useAPI"
import { useProfilePopup } from "hooks/useAppContext"
import { useSocket } from "hooks/useSocket"
import useToolkit from "hooks/useToolkit"
import { setInviteRoomId, setPopup, setUserId } from "toolkit/slice/game"
import { APIResponse } from "types/Common"
import { Users } from "types/Entities"
import { SearchUserType } from "../types"
import "../../../pages/Dashboard/Dashboard.scss"

export const SearchUserPopup = () => {
	const { gameState, state, dispatch } = useToolkit()
	const { setProfileUser } = useProfilePopup()
	const { searchUsers } = useAPI()
	const { emitRoomInvite } = useSocket()
	const [searchQuery, setSearchQuery] = useState("")
	const [results, setResults] = useState<SearchUserType[]>([])
	const [loading, setLoading] = useState(false)
	const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

	const isOpen = (gameState.popupState & PopupState.SEARCH_USERS) === PopupState.SEARCH_USERS

	const closePopup = () => {
		dispatch(setPopup(gameState.popupState & ~PopupState.SEARCH_USERS))
		dispatch(setInviteRoomId(null))
		setSearchQuery("")
		setResults([])
	}

	const handleSelectUserForChat = (user: SearchUserType) => {
		dispatch(setUserId(user.id))
		const newPopupState = (gameState.popupState & ~PopupState.SEARCH_USERS) | PopupState.SEND_PM
		dispatch(setPopup(newPopupState))
		setProfileUser(user as Users)
		setSearchQuery("")
		setResults([])
	}

	const handleSelectUserForInvite = (user: SearchUserType) => {
		if (gameState.inviteRoomId === null) return
		const claims = getClaimsFromLocalStorage()
		const inviterId = Number(claims?.sub)
		if (!inviterId || isNaN(inviterId)) return
		emitRoomInvite(gameState.inviteRoomId, user.id, inviterId)
		closePopup()
	}

	const handleSelectUserFunc = gameState.inviteRoomId !== null
		? handleSelectUserForInvite
		: handleSelectUserForChat

	const performSearch = async (query: string) => {
		if (!query.trim()) {
			setResults([])
			return
		}

		setLoading(true)
		try {
			const token = getToken()
			if (!token) return

			// exclude users who cannot afford the room's bet
			// In chat context it stays undefined.
			const response = await searchUsers(
				token,
				query,
				gameState.inviteRoomId
			) as APIResponse<SearchUserType[]>
			if (response?.success && response.data) {
				setResults(response.data)
			} else {
				setResults([])
			}
		} catch {
			setResults([])
		} finally {
			setLoading(false)
		}
	}

	const handleSearchChange = (value: string) => {
		setSearchQuery(value)

		if (debounceRef.current) {
			clearTimeout(debounceRef.current)
		}

		debounceRef.current = setTimeout(() => {
			performSearch(value)
		}, 200)
	}

	// Cleanup debounce on unmount
	useEffect(() => {
		return () => {
			if (debounceRef.current) {
				clearTimeout(debounceRef.current)
			}
		}
	}, [])

	// Clear results when popup closes
	useEffect(() => {
		if (!isOpen) {
			setSearchQuery("")
			setResults([])
		}
	}, [isOpen])

	return (
		<Dialog
			open={isOpen}
			onClose={closePopup}
			maxWidth="xs"
			fullWidth
		>
			<DialogTitle>
				<TTypography content="search.user.title" />
			</DialogTitle>
			<DialogContent>
				<Box sx={{ pt: 1 }}>
					<TTextField
						value={searchQuery}
						onChange={e => handleSearchChange(e.target.value)}
						placeholder="search.user.placeholder"
						size="small"
						fullWidth
						autoFocus
					/>
				</Box>

				{loading && (
					<Box sx={{ display: "flex", justifyContent: "center", my: 2 }}>
						<CircularProgress size={24} />
					</Box>
				)}

				{!loading && results.length > 0 && (
					<Box sx={{ maxHeight: 200, overflow: "auto", my: 1 }}>
						<List className="no-padding">
							{results.map(user => (
								<ListItem key={user.id} disablePadding>
									<ListItemButton
										className="gap-1"
										onClick={() => handleSelectUserFunc(user)}
									>
										<UserAvatar
											id={user.id}
											avatar_url={user.avatar_url}
											display_name={user.display_name}
											showPresence
											size={32}
										/>
										<Typography variant="body2">
											{user.display_name}
										</Typography>
										<Typography variant="body2" className="user-amount">
											<span className="mr-5">
												{formatNumber(user.total_amount, state.lang)}
											</span>
											<i className="fas fa-coins bet-icon" />
										</Typography>
									</ListItemButton>
								</ListItem>
							))}
						</List>
					</Box>
				)}

				{!loading && searchQuery.trim() && results.length === 0 && (
					<Box sx={{ textAlign: "center", my: 2 }}>
						<TTypography variant="body2" color="textSecondary" content="search.user.no-results" />
					</Box>
				)}
			</DialogContent>
			<Divider className="menu-divider" />
			<DialogActions className="pb-16">
				<TButton
					variant="contained"
					size="medium"
					value="search.button.search"
					startIcon={<ClaimIconButton isClaiming={loading} icon="fa-magnifying-glass" />}
				/>
				<TButton
					variant="outlined"
					size="medium"
					onClick={closePopup}
					value="settings.close"
					startIcon={<i className="fas fa-xmark" />}
				/>
			</DialogActions>
		</Dialog>
	)
}
