import {
	UIEvent,
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState
} from "react"
import { Box, Divider, Skeleton, Stack } from "@mui/material"
import { TTypography } from "components/TranslationTag"
import { MessageInput, MessageList } from "components/MessageThread"
import { getCurrentUserId, getToken } from "common/helper"
import useAutoTitle from "hooks/useAutoTitle"
import { useAPI } from "hooks/useAPI"
import { useSocket } from "hooks/useSocket"
import useLayoutAuth from "pages/Dashboard/hook"
import { AnnouncementMessage, BaseChatMessage } from "components/ChatDialog/types"
import "./Announce.scss"

// Keep in sync with the backend READ_PAGE_SIZE in get-announcement.ts: a full
// page implies more history may exist, a short page means we reached the start.
const ANNOUNCE_PAGE_SIZE = 20
// Distance (px) from the top that triggers loading the previous page.
const SCROLL_TOP_THRESHOLD = 60

function LoadingSkeleton() {
	return (
		<Stack spacing={1.5} className="announce-messages-skeleton">
			{Array.from({ length: 6 }, (_, idx) => (
				<Box key={idx} className="announce-skeleton-row">
					<Skeleton variant="circular" width={32} height={32} />
					<Box className="announce-skeleton-content">
						<Skeleton variant="text" width="40%" height={20} />
						<Skeleton variant="rounded" width="100%" height={36} />
					</Box>
				</Box>
			))}
		</Stack>
	)
}

function EmptyAnnouncement() {
	return (<Stack spacing={1} className="announce-messages-empty">
		<TTypography variant="body2" color="text.secondary" content="announce.empty" />
	</Stack>
	)
}

export default function AnnouncePage() {
	useAutoTitle("announce.title")
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
	const [isInitialLoading, setIsInitialLoading] = useState(true)
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

	const handleAvatarClick = (userId: number) => {
		const activeElement = document.activeElement as HTMLElement | null
		activeElement?.blur()
		showProfilePopup(userId)
	}

	// Load announcements on mount: render them, flag the first unread, then mark
	// the feed as read so the next visit treats everything as seen.
	useEffect(() => {
		const loadAnnouncements = async () => {
			const token = getToken()
			if (!token) {
				setIsInitialLoading(false)
				return
			}

			try {
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
			} finally {
				setIsInitialLoading(false)
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

	const getRowRef = (msg: BaseChatMessage, idx: number) => (el: HTMLDivElement | null) => {
		if (idx === 0) firstMessageRef.current = el
		if (msg._id === firstUnreadId) firstUnreadRef.current = el
	}

	const fullMessages = messages.length > 0 ? (
		<MessageList
			messages={messages}
			firstUnreadId={firstUnreadId}
			isUnread={msg => msg.seen === false}
			onAvatarClick={handleAvatarClick}
			endRef={messagesEndRef}
			getRowRef={getRowRef}
			loadingOlder={loadingOlder}
		/>
	) : (
		<EmptyAnnouncement />
	)

	return (
		<Box className="announce-page">
			<TTypography
				variant="h6"
				className="announce-title"
				content="announce.title"
			/>
			<Divider sx={{ borderColor: "primary.main" }} />

			<Box
				className="announce-messages-box custom-scrollbar"
				ref={containerRef}
				onScroll={handleScroll}
			>
				{isInitialLoading ? <LoadingSkeleton /> : fullMessages}
			</Box>

			<MessageInput
				value={messageContent}
				placeholder="announce.placeholder"
				disabled={!canSend}
				onChange={setMessageContent}
				onSend={handleSend}
			/>
		</Box>
	)
}
