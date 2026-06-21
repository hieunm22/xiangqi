import {
	KeyboardEvent,
	useEffect,
	useMemo,
	useRef,
	useState
} from "react"
import classnames from "classnames"
import {
	Box,
	Divider,
	Stack,
	Tooltip,
	Typography
} from "@mui/material"
import { TI, TTextField, TTypography } from "components/TranslationTag"
import { UserAvatar } from "pages/Dashboard/components/UserAvatar"
import {
	formatTimestampToDateTimeArray,
	getClaimsFromLocalStorage,
	getToken
} from "common/helper"
import useAutoTitle from "hooks/useAutoTitle"
import { useAPI } from "hooks/useAPI"
import useToolkit from "hooks/useToolkit"
import { useSocket } from "hooks/useSocket"
import useLayoutAuth from "pages/Dashboard/hook"
import { AnnouncementMessage } from "components/ChatDialog/types"
import "./Announce.scss"

export default function AnnouncePage() {
	useAutoTitle("announce.title")
	const { state } = useToolkit()
	const {
		getAnnouncements,
		markAnnouncementAsRead,
		sendAnnouncement
	} = useAPI()
	const { offAnnouncementSent, onAnnouncementSent } = useSocket()
	const { showProfilePopup } = useLayoutAuth()

	const [messageContent, setMessageContent] = useState("")
	const [messages, setMessages] = useState<AnnouncementMessage[]>([])
	const [sending, setSending] = useState(false)
	// _id of the first unread announcement; null when everything has been read.
	const [firstUnreadId, setFirstUnreadId] = useState<string | null>(null)
	const messagesEndRef = useRef<HTMLDivElement | null>(null)

	const canSend = messageContent.trim().length > 0 && !sending
	const currentUserId = useMemo(() => {
		const payload = getClaimsFromLocalStorage()
		const id = Number(payload?.sub)
		return Number.isNaN(id) ? null : id
	}, [])

	const scrollToBottom = () => {
		messagesEndRef.current?.scrollIntoView({ block: "end", behavior: "smooth" })
	}

	// Load announcements on mount: render them, flag the first unread, then mark
	// the feed as read so the next visit treats everything as seen.
	useEffect(() => {
		const loadAnnouncements = async () => {
			const token = getToken()
			if (!token) {
				return
			}

			const response = await getAnnouncements(token)
			if (response?.success && response.data) {
				const nextMessages = response.data as AnnouncementMessage[]
				const unreadIndex = nextMessages.findIndex(msg => !msg.seen)

				setMessages(nextMessages)
				setFirstUnreadId(unreadIndex >= 0 ? nextMessages[unreadIndex]._id : null)

				if (unreadIndex >= 0) {
					await markAnnouncementAsRead(token)
				}
			}
		}

		loadAnnouncements()
	}, [])

	// Append announcements arriving from other clients in real time. Dedupe by
	// _id (our own just-sent message is already in the list). The viewer is
	// actively reading, so persist a read mark for messages from others.
	useEffect(() => {
		const handleIncoming = (data: any) => {
			const incoming = { ...data, seen: true } as AnnouncementMessage
			setMessages(prev => {
				if (prev.some(msg => msg._id === incoming._id)) {
					return prev
				}
				return [...prev, incoming]
			})

			if (data?.userId !== currentUserId) {
				const token = getToken()
				if (token) {
					markAnnouncementAsRead(token)
				}
			}
		}

		onAnnouncementSent(handleIncoming)
		return () => offAnnouncementSent(handleIncoming)
	}, [onAnnouncementSent, offAnnouncementSent, currentUserId])

	useEffect(() => {
		scrollToBottom()
	}, [messages])

	const handleSend = async () => {
		const message = messageContent.trim()
		if (!message || sending) {
			return
		}

		const token = getToken()
		if (!token) {
			return
		}

		setSending(true)
		const response = await sendAnnouncement(token, message)

		if (response?.success && response.data) {
			const nextMessage = { ...response.data, seen: true } as AnnouncementMessage
			// Dedupe by _id: the socket broadcast for our own message may arrive
			// before this response resolves, so guard against a double append.
			setMessages(prev => {
				if (prev.some(msg => msg._id === nextMessage._id)) {
					return prev
				}
				return [...prev, nextMessage]
			})
			setFirstUnreadId(null)
			setMessageContent("")
			// The author has implicitly read up to their own message.
			await markAnnouncementAsRead(token)
		}
		setSending(false)
	}

	const handleKeyDown = (e: KeyboardEvent) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault()
			handleSend()
		}
	}

	const sendClass = classnames("fas fa-paper-plane announce-send-icon", {
		disabled: !canSend
	})

	return (
		<Box className="announce-page">
			<TTypography
				variant="h6"
				className="announce-title"
				content="announce.title"
				/>
			<Divider sx={{ borderColor: "primary.main" }} />

			<Box className="announce-messages-box">
				{messages.length === 0 ? (
					<Stack spacing={1} className="announce-messages-empty">
						<TTypography variant="body2" color="text.secondary" content="announce.empty" />
					</Stack>
				) : (
					<Stack spacing={1}>
						{messages.map((msg, idx) => {
							const isSender = msg.sender?.id === currentUserId
							const senderId = msg.sender?.id ?? null
							const nextSenderId = messages[idx + 1]?.sender?.id ?? null
							const isLastMessageInSenderGroup = senderId === null || senderId !== nextSenderId
							const shouldShowAvatar = !isSender && isLastMessageInSenderGroup
							const isUnread = !msg.seen
							const showUnreadDivider = firstUnreadId !== null && msg._id === firstUnreadId
							const boxContent = classnames("announce-message-row", {
								end: isSender,
								start: !isSender
							})
							const contentClass = classnames("announce-message-content", {
								sender: isSender,
								receiver: !isSender,
								unread: isUnread
							})
							const senderName = msg.sender?.display_name || "Unknown user"
							const times = formatTimestampToDateTimeArray(msg.timestamp, state.lang)
							const timeString = `${times[0] ? times[0] + ", " : ""}${times[1]}`

							return (
								<Box key={msg._id}>
									{showUnreadDivider && (
										<Divider textAlign="center" className="announce-unread-divider">
											<TTypography
												variant="caption"
												className="announce-unread-divider-text"
												content="chat.messages.unread"
											/>
										</Divider>
									)}
									<Box className={boxContent}>
										{!isSender && (
											<Box className="announce-avatar-container">
												{shouldShowAvatar && (
													<UserAvatar
														id={msg.sender?.id ?? 0}
														avatar_url={msg.sender?.avatar_url || ""}
														display_name={senderName}
														onUserClick={showProfilePopup}
														size={36}
													/>
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
						<div ref={messagesEndRef} />
					</Stack>
				)}
			</Box>

			<Box className="announce-input-row">
				<TTextField
					value={messageContent}
					onChange={e => setMessageContent(e.target.value)}
					onKeyDown={handleKeyDown}
					placeholder="announce.placeholder"
					size="small"
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
		</Box>
	)
}
