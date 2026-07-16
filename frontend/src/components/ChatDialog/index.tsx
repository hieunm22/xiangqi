import {
	forwardRef,
	MouseEvent as ReactMouseEvent,
	useCallback,
	useEffect,
	useImperativeHandle,
	useLayoutEffect,
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
} from "@mui/material"
import { PopupState } from "common/enums"
import { TI, TSpan } from "components/TranslationTag"
import { MessageInput, MessageList } from "components/MessageThread"
import { getToken } from "common/helper"
import useToolkit from "hooks/useToolkit"
import useLayoutAuth from "pages/Dashboard/hook"
import { setPopup } from "toolkit/slice/game"
import {
	BaseChatMessage,
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
	const { gameState, dispatch } = useToolkit()
	const {
		getMessages,
		markAsRead,
		sendMessage,
	} = props
	const [messageContent, setMessageContent] = useState("")
	// _id of the first unread message; null when everything has been read.
	const [firstUnreadId, setFirstUnreadId] = useState<string | null>(null)
	const [messages, setMessages] = useState<ChatMessage[]>([])
	const [sending, setSending] = useState(false)
	const [position, setPosition] = useState<MousePosition>({ x: 0, y: 0 })
	const [menuOpen, setMenuOpen] = useState(false)
	const dragRef = useRef<ChatDialogDragPosition | null>(null)
	const messagesEndRef = useRef<HTMLDivElement | null>(null)
	const firstUnreadRef = useRef<HTMLDivElement | null>(null)
	// True until the post-load scroll has run for the current conversation, so we
	// scroll to the first unread (or bottom) once per load and to the bottom after.
	const didInitialScrollRef = useRef(false)
	const refId = props.refId // refId can be roomId or userId depending on the chat type
	const { showProfilePopup } = useLayoutAuth()

	const canSend = messageContent.trim().length > 0
	const isChatMode = !!refId

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

			// A fresh conversation load: let the next render scroll to the first
			// unread message (or the bottom when everything has been read).
			didInitialScrollRef.current = false

			// Auto-open the drawer when there's no active conversation
			setMenuOpen(!!props.drawerContent && refId === null)

			const token = getToken()
			if (!token || refId === null) {
				return
			}

			const response = await getMessages(token, refId)
			if (response?.success && response.data) {
				const nextMessages = response.data as ChatMessage[]
				// Find first unread message (seen === false means unread)
				const unreadIndex = nextMessages.findIndex(m => !m.seen)

				setMessages(nextMessages)
				setFirstUnreadId(unreadIndex >= 0 ? nextMessages[unreadIndex]._id : null)

				// Mark as read only when there is at least one unread message.
				if (unreadIndex >= 0) {
					await markAsRead(token, refId)
				}
			}
		}

		loadMessages()
	}, [props.open, refId])

	// On initial load, scroll to the first unread message (or bottom if all read).
	// After that, keep pinned to the bottom on send/receive.
	useLayoutEffect(() => {
		if (!messages.length) {
			return
		}
		if (!didInitialScrollRef.current) {
			didInitialScrollRef.current = true
			if (firstUnreadRef.current) {
				firstUnreadRef.current.scrollIntoView({ block: "start" })
			} else {
				messagesEndRef.current?.scrollIntoView({ block: "end" })
			}
			return
		}
		messagesEndRef.current?.scrollIntoView({ block: "end", behavior: "smooth" })
	}, [messages])

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
			setFirstUnreadId(message._id)
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
				seen: response.data.seen ?? false
			}
			setMessages([...messages, nextMessage])
			setFirstUnreadId(null)
			setMessageContent("")
			props.onMessageSent && props.onMessageSent({
				message,
				receiverId: refId,
				timestamp: nextMessage.timestamp
			})
		}
		setSending(false)
	}

	const getIsUnread = (msg: BaseChatMessage, isSender: boolean) => !isSender && !msg.seen

	const getRowRef = (msg: BaseChatMessage) => {
		return msg._id === firstUnreadId ? firstUnreadRef : undefined
	}

	const onShowProfile = (userId: number) => {
		// Blur all inputs and textareas in the chat dialog to prevent focus conflicts
		const inputs = document.querySelectorAll(".chat-dialog input, .chat-dialog textarea")
		inputs.forEach(input => {
			(input as HTMLElement).blur()
		})

		handleClose(null, "escapeKeyDown")
		showProfilePopup(userId)
	}

	const onNewConversation = () => {
		dispatch(setPopup(gameState.popupState | PopupState.SEARCH_USERS))
	}

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
			disableAutoFocus
			autoFocus={false}
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
				className="chat-dialog-title chat-dialog-drag-handle"
				onMouseDown={handleDragStart}
			>
				<Box className="chat-title-left">
					{hasDrawer && (
						<TI
							className="fas fa-plus chat-menu-icon"
							onClick={onNewConversation}
							title="chat.conversations.new"
						/>
					)}
					{hasDrawer && (
						<TI
							className="fas fa-bars chat-menu-icon"
							onClick={() => setMenuOpen(prev => !prev)}
							title="chat.conversations.toggle"
						/>
					)}
					<TSpan className="chat-title-text" content={props.title} />
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
					<MessageList
						messages={messages}
						firstUnreadId={firstUnreadId}
						isUnread={getIsUnread}
						onAvatarClick={onShowProfile}
						showPresence
						endRef={messagesEndRef}
						getRowRef={getRowRef}
						loadingOlder={false}
					/>
				</Box>

				<MessageInput
					value={messageContent}
					placeholder="room.actions.send-pm"
					disabled={!canSend || sending}
					autoFocus
					onChange={setMessageContent}
					onSend={handleSend}
				/>
			</DialogContent>
		</Dialog>
	)
})

ChatDialog.displayName = "ChatDialog"

export default ChatDialog
