import {
	forwardRef,
	KeyboardEvent,
	MouseEvent as ReactMouseEvent,
	useCallback,
	useEffect,
	useImperativeHandle,
	useMemo,
	useRef,
	useState
} from "react"
import classnames from "classnames"
import {
	Box,
	Dialog,
	DialogContent,
	DialogTitle,
	Divider,
	Stack,
	TextField,
	Tooltip,
	Typography
} from "@mui/material"
import { TI, TTypography } from "components/TranslationTag"
import { UserAvatar } from "pages/Dashboard/components/UserAvatar"
import {
	formatTimestampToDateTimeArray,
	getClaimsFromLocalStorage,
	getToken,
} from "common/helper"
import useToolkit from "hooks/useToolkit"
import useLayoutAuth from "pages/Dashboard/hook"
import { translate } from "locales/translate"
import {
	ChatDialogDragPosition,
	ChatDialogHandle,
	ChatDialogProps,
	MousePosition,
	PrivateChatMessage,
	RoomChatMessage
} from "./types"
import "./ChatDialog.scss"

type ChatMessage = RoomChatMessage | PrivateChatMessage

const ChatDialog = forwardRef<ChatDialogHandle, ChatDialogProps>((props, ref) => {
	const { state } = useToolkit()
	const {
		getMessages,
		markAsRead,
		sendMessage,
	} = props
	const [messageContent, setMessageContent] = useState("")
	const [firstUnreadIndex, setFirstUnreadIndex] = useState<number | null>(null)
	const [messages, setMessages] = useState<ChatMessage[]>([])
	const [sending, setSending] = useState(false)
	const [position, setPosition] = useState<MousePosition>({ x: 0, y: 0 })
	const [menuOpen, setMenuOpen] = useState(false)
	const dragRef = useRef<ChatDialogDragPosition | null>(null)
	const refId = props.refId // refId can be roomId or userId depending on the chat type
	const { showProfilePopup } = useLayoutAuth()

	const canSend = messageContent.trim().length > 0
	const isChatMode = !!refId
	const currentUserId = useMemo(() => {
		const payload = getClaimsFromLocalStorage()
		const id = Number(payload?.sub)
		return Number.isNaN(id) ? null : id
	}, [])

	// Drag-to-move: track the window-level mouse while a drag is active so the
	// popup keeps following the cursor even if it leaves the title bar.
	const handleDragMove = useCallback((e: MouseEvent) => {
		const drag = dragRef.current
		if (!drag) return
		setPosition({
			x: drag.originX + e.clientX - drag.startX,
			y: drag.originY + e.clientY - drag.startY,
		})
	}, [])

	const handleDragEnd = useCallback(() => {
		dragRef.current = null
		document.removeEventListener("mousemove", handleDragMove)
		document.removeEventListener("mouseup", handleDragEnd)
	}, [handleDragMove])

	const handleDragStart = (e: ReactMouseEvent) => {
		// Don't start a drag when clicking the title-bar icons.
		if ((e.target as HTMLElement).closest(".chat-close-icon, .chat-menu-icon")) return
		// Prevent text selection while dragging.
		e.preventDefault()
		dragRef.current = {
			startX: e.clientX,
			startY: e.clientY,
			originX: position.x,
			originY: position.y,
		}
		document.addEventListener("mousemove", handleDragMove)
		document.addEventListener("mouseup", handleDragEnd)
	}

	// Clean up listeners if the dialog unmounts mid-drag.
	useEffect(() => () => {
		document.removeEventListener("mousemove", handleDragMove)
		document.removeEventListener("mouseup", handleDragEnd)
	}, [handleDragMove, handleDragEnd])

	const handleClose = (_: any, reason: "backdropClick" | "escapeKeyDown") => {
		if (reason === "backdropClick") {
			return
		}
		props.onClose()
	}

	const findIndexCallback = (msg: ChatMessage) => {
		if (props.dialogType === "private")
			return (msg as PrivateChatMessage).status === 1
		else if (props.dialogType === "room") {
			return !(msg as RoomChatMessage).read_by.includes(currentUserId || 0)
		}
		return false
	}

	// Reset the popup back to the centered position each time it opens.
	useEffect(() => {
		if (props.open) {
			setPosition({ x: 0, y: 0 })
		}
	}, [props.open])

	// Load messages when the dialog opens or when the active conversation
	// (refId) changes — e.g. picking a different conversation in the drawer.
	useEffect(() => {
		const loadMessages = async () => {
			if (!props.open) {
				return
			}

			// Auto-open the drawer when there's no active conversation
			setMenuOpen(!!props.drawerContent && refId === null)

			const token = getToken()
			if (!token || refId === null) {
				return
			}

			const response = await getMessages(token, refId)
			if (response?.success && response.data) {
				const nextMessages = response.data as ChatMessage[]
				// Find first unread message (status = 1 means unread)
				const unreadIndex = nextMessages.findIndex(findIndexCallback)

				setMessages(nextMessages)
				setFirstUnreadIndex(unreadIndex >= 0 ? unreadIndex : null)

				// Mark as read only when there is at least one unread message.
				if (unreadIndex >= 0) {
					await markAsRead(token, refId)
				}
			}
		}

		loadMessages()
	}, [props.open, refId])

	// Expose an imperative append so callers (e.g. RoomChatDialog) can push a
	// real-time message into the open dialog without owning the message list.
	useImperativeHandle(ref, () => ({
		appendMessage: (message) => {
			setMessages(prev => {
				if (prev.some(msg => msg._id === message._id)) {
					return prev
				}
				return [...prev, message as ChatMessage]
			})
			setFirstUnreadIndex(null)
		}
	}), [])

	const handleSend = async () => {
		const message = messageContent.trim()
		if (!message || sending) return

		const token = getToken()
		if (!token) {
			return
		}

		setSending(true)

		if (!isChatMode) {
			return
		}

		const response = await sendMessage(token, refId, message)

		if (response?.success && response.data) {
			const nextMessage = {
				...response.data,
				status: response.data.status || 1
			}
			setMessages([...messages, nextMessage])
			setFirstUnreadIndex(null)
			setMessageContent("")
		}
		setSending(false)
	}

	const handleKeyDown = (e: KeyboardEvent) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault()
			handleSend()
		}
	}

	const onShowProfile = (userId: number) => {
		handleClose(null, "escapeKeyDown")
		showProfilePopup(userId)
	}

	const sendClass = classnames("fas fa-paper-plane end-icon", {
		disabled: !canSend || sending
	})

	const hasDrawer = !!props.drawerContent
	const innnerOverlayClass = classnames("chat-inner-drawer-overlay", { open: menuOpen })
	const innnerDrawerClass = classnames("chat-inner-drawer", { open: menuOpen })

	return (
		<Dialog
			open={props.open}
			onClose={handleClose}
			className="chat-dialog"
			maxWidth="sm"
			fullWidth
			disableEnforceFocus
			hideBackdrop
			disableScrollLock
			// Let clicks pass through to the board behind the popup; only the
			// dialog paper itself stays interactive.
			sx={{ pointerEvents: "none" }}
			slotProps={{
				paper: {
					style: {
						pointerEvents: "auto",
						transform: `translate(${position.x}px, ${position.y}px)`
					}
				}
			}}
		>
			<DialogTitle
				className="chat-dialog-title chat-dialog-drag-handle pt-8 pb-8"
				onMouseDown={handleDragStart}
			>
				<Box className="chat-title-left">
					{hasDrawer && (
						<TI
							className="fas fa-bars chat-menu-icon"
							onClick={() => setMenuOpen(prev => !prev)}
							title="menu.app-name"
						/>
					)}
					<span className="chat-title-text">{translate(props.title)}</span>
				</Box>
				<TI
					className="fas fa-xmark chat-close-icon"
					onClick={e => handleClose(e, "escapeKeyDown")}
					title="settings.close"
				/>
			</DialogTitle>
			<Divider sx={{ borderColor: "primary.main" }} />
			<DialogContent className="chat-dialog-content">
				{hasDrawer && (
					<Box
						className={innnerOverlayClass}
						onClick={() => setMenuOpen(false)}
					/>
				)}
				{hasDrawer && (
					<Box className={innnerDrawerClass} sx={{ bgcolor: "background.paper" }}>
						{props.drawerContent}
					</Box>
				)}
				<Box className="chat-messages-box">
					<Stack spacing={1}>
						{messages.map((msg, idx) => {
							const showUnreadDivider = firstUnreadIndex !== null && idx === firstUnreadIndex
							const isSender = msg.sender?.id === currentUserId
							const senderId = msg.sender?.id ?? null
							const nextSenderId = messages[idx + 1]?.sender?.id ?? null
							const isLastMessageInSenderGroup = senderId === null || senderId !== nextSenderId
							const shouldShowAvatar = !isSender && isLastMessageInSenderGroup
							const boxContent = classnames("flex", {
								"end": isSender,
								"start": !isSender
							})
							const contentClass = classnames("chat-message-content", {
								sender: isSender,
								receiver: !isSender
							})
							const senderName = msg.sender?.display_name || "Unknown user"
							const times = formatTimestampToDateTimeArray(msg.timestamp, state.lang)
							const timeString = `${times[0] ? times[0] + ", " : ""}${times[1]}`
							return (
								<Box key={msg._id}>
									{showUnreadDivider && (
										<Divider textAlign="center" className="chat-unread-divider">
											<TTypography
												variant="caption"
												className="chat-unread-divider-text"
												content="room.messages.unread"
											/>
										</Divider>
									)}
									<Box className={boxContent}>
										{!isSender && (
											<Box className="chat-avatar-container">
												{shouldShowAvatar && (
													<Tooltip title={senderName} arrow placement="top">
														<UserAvatar
															id={msg.sender?.id}
															avatar_url={msg.sender?.avatar_url || ""}
															display_name={senderName}
															onUserClick={onShowProfile}
															size={36}
														/>
													</Tooltip>
												)}
											</Box>
										)}
										<Tooltip title={timeString} arrow placement={isSender ? "left" : "right"}>
											<Typography variant="body2" className={contentClass}>
												{msg.message}
											</Typography>
										</Tooltip>
									</Box>
								</Box>
							)
						})}
					</Stack>
				</Box>

				<Box className="chat-input-row">
					<TextField
						value={messageContent}
						onChange={e => setMessageContent(e.target.value)}
						onKeyDown={handleKeyDown}
						placeholder={translate("room.actions.send-pm")}
						size="small"
						autoFocus
						fullWidth
						multiline
						maxRows={3}
						slotProps={{
							input: {
								endAdornment: (
									<TI className={sendClass} onClick={handleSend} />
								)
							}
						}}
					/>
				</Box>
			</DialogContent>
		</Dialog>
	)
})

ChatDialog.displayName = "ChatDialog"

export default ChatDialog
