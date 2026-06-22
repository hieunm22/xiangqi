import {
	KeyboardEvent,
	UIEvent,
	useCallback,
	useEffect,
	useLayoutEffect,
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
	getCurrentUserId,
	getToken
} from "common/helper"
import useAutoTitle from "hooks/useAutoTitle"
import { useAPI } from "hooks/useAPI"
import useToolkit from "hooks/useToolkit"
import { useSocket } from "hooks/useSocket"
import useLayoutAuth from "pages/Dashboard/hook"
import { AnnouncementMessage } from "components/ChatDialog/types"
import "./Announce.scss"

// Keep in sync with the backend READ_PAGE_SIZE in get-announcement.ts: a full
// page implies more history may exist, a short page means we reached the start.
const ANNOUNCE_PAGE_SIZE = 20
// Distance (px) from the top that triggers loading the previous page.
const SCROLL_TOP_THRESHOLD = 60

export default function AnnouncePage() {
	useAutoTitle("announce.title")
	const { state } = useToolkit()
	const {
		getAnnouncements,
		getAnnouncementsMore,
		markAnnouncementAsRead,
		sendAnnouncement
	} = useAPI()
	const { offAnnouncementSent, onAnnouncementSent } = useSocket()
	const { showProfilePopup } = useLayoutAuth()

	const [messageContent, setMessageContent] = useState("")
	const [messages, setMessages] = useState<AnnouncementMessage[]>([])
	const [sending, setSending] = useState(false)
	const [hasMore, setHasMore] = useState(true)
	const [loadingOlder, setLoadingOlder] = useState(false)
	// _id of the first unread announcement; null when everything has been read.
	const [firstUnreadId, setFirstUnreadId] = useState<string | null>(null)
	const containerRef = useRef<HTMLDivElement | null>(null)
	const messagesEndRef = useRef<HTMLDivElement | null>(null)
	const firstUnreadRef = useRef<HTMLDivElement | null>(null)
	const firstMessageRef = useRef<HTMLDivElement | null>(null)
	// True until the post-load scroll has run, so we scroll to the first unread
	// (or bottom) once on load and keep pinning to the bottom afterwards.
	const didInitialScrollRef = useRef(false)
	// The DOM node + its layout offset for the message that sat at the top before
	// a "load older" prepend, so we can keep that exact message in place after the
	// older page renders (immune to the loading indicator's height changing).
	const anchorNodeRef = useRef<HTMLDivElement | null>(null)
	const anchorOffsetRef = useRef(0)
	// Synchronous guard so rapid scroll events can't fire overlapping page loads
	// before the loadingOlder state has had a chance to update.
	const loadingOlderRef = useRef(false)

	const canSend = messageContent.trim().length > 0 && !sending
	const currentUserId = getCurrentUserId()

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

	// After messages render: restore the scroll anchor after a prepend, scroll to
	// the first unread (or bottom) on the initial load, otherwise pin to bottom.
	useLayoutEffect(() => {
		if (!messages.length) {
			return
		}
		const container = containerRef.current
		if (anchorNodeRef.current && container) {
			// Keep the previously-top message pinned: shift the scroll by how far
			// that same node moved down once the older page was prepended.
			container.scrollTop += anchorNodeRef.current.offsetTop - anchorOffsetRef.current
			anchorNodeRef.current = null
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

	// Infinite scroll-up: when the viewport nears the top, page in the older
	// announcements that sit before the currently loaded window.
	const loadOlder = useCallback(async () => {
		if (loadingOlderRef.current || !hasMore) {
			return
		}
		const oldest = messages[0]
		const container = containerRef.current
		if (!oldest || !container) {
			return
		}

		const token = getToken()
		if (!token) {
			return
		}

		loadingOlderRef.current = true
		setLoadingOlder(true)
		const response = await getAnnouncementsMore(token, oldest.timestamp)
		if (response?.success && response.data) {
			const older = response.data as AnnouncementMessage[]
			if (older.length < ANNOUNCE_PAGE_SIZE) {
				setHasMore(false)
			}
			const existing = new Set(messages.map(msg => msg._id))
			const fresh = older.filter(msg => !existing.has(msg._id))
			if (fresh.length > 0) {
				// Anchor on the current top message before it shifts down.
				anchorNodeRef.current = firstMessageRef.current
				anchorOffsetRef.current = firstMessageRef.current?.offsetTop ?? 0
				setMessages(prev => [...fresh, ...prev])
			}
		}
		loadingOlderRef.current = false
		setLoadingOlder(false)
	}, [getAnnouncementsMore, hasMore, messages])

	const handleScroll = (e: UIEvent<HTMLDivElement>) => {
		if (e.currentTarget.scrollTop <= SCROLL_TOP_THRESHOLD) {
			loadOlder()
		}
	}

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

			<Box
				className="announce-messages-box"
				ref={containerRef}
				onScroll={handleScroll}
			>
				{messages.length === 0 ? (
					<Stack spacing={1} className="announce-messages-empty">
						<TTypography variant="body2" color="text.secondary" content="announce.empty" />
					</Stack>
				) : (
					<Stack spacing={1}>
						{loadingOlder && (
							<TTypography
								variant="caption"
								color="text.secondary"
								className="announce-loading-older"
								content="announce.loading-older"
							/>
						)}
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
							const getRefObj = (el: HTMLDivElement | null) => {
								if (idx === 0) firstMessageRef.current = el
								if (msg._id === firstUnreadId) firstUnreadRef.current = el
							}

							return (
								<Box key={msg._id} ref={getRefObj}>
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
