import { useEffect, useRef, useState } from "react"
import {
	Avatar,
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
import { getClaimsFromLocalStorage, getToken, requireImage } from "common/helper"
import { useAPI } from "hooks/useAPI"
import { useSocket } from "hooks/useSocket"
import useToolkit from "hooks/useToolkit"
import { setInviteRoomId, setPopup, setUserId } from "toolkit/slice/game"
import { APIResponse, UserAvatarType } from "types/Common"

export const SearchUserPopup = () => {
	const { gameState, dispatch } = useToolkit()
	const { searchUsers } = useAPI()
	const { emitRoomInvite } = useSocket()
	const [searchQuery, setSearchQuery] = useState("")
	const [results, setResults] = useState<UserAvatarType[]>([])
	const [loading, setLoading] = useState(false)
	const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

	const isOpen = (gameState.popupState & PopupState.SEARCH_USERS) === PopupState.SEARCH_USERS

	const closePopup = () => {
		dispatch(setPopup(gameState.popupState & ~PopupState.SEARCH_USERS))
		dispatch(setInviteRoomId(null))
		setSearchQuery("")
		setResults([])
	}

	const handleSelectUserForChat = (user: UserAvatarType) => {
		dispatch(setUserId(user.id))
		const newPopupState = (gameState.popupState & ~PopupState.SEARCH_USERS) | PopupState.SEND_PM
		dispatch(setPopup(newPopupState))
		setSearchQuery("")
		setResults([])
	}

	const handleSelectUserForInvite = (user: UserAvatarType) => {
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

			const response = await searchUsers(token, query) as APIResponse<UserAvatarType[]>
			if (response?.success && response.data) {
				setResults(response.data)
			} else {
				setResults([])
			}
		} catch (error) {
			console.error("Search error:", error)
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
										sx={{ gap: 1 }}
										onClick={() => handleSelectUserFunc(user)}
									>
										<Avatar
											src={requireImage(user.avatar_url)}
											alt={user.display_name}
											sx={{ width: 32, height: 32 }}
										/>
										<Typography variant="body2">
											{user.display_name}
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
				<TButton variant="contained" size="medium" value="search.button.search" />
				<TButton size="medium" onClick={closePopup} value="settings.close" />
			</DialogActions>
		</Dialog>
	)
}
