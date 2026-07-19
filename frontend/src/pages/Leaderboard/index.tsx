import { UIEvent, useEffect, useRef, useState } from "react"
import {
	Box,
	CircularProgress,
	Divider,
	List,
	ListItem,
	ListItemButton,
	Skeleton,
	Typography
} from "@mui/material"
import classnames from "classnames"
import { TTextField, TTypography } from "components/TranslationTag"
import { formatNumber, getToken } from "common/helper"
import { UserAvatar } from "pages/Dashboard/components/UserAvatar"
import useAutoTitle from "hooks/useAutoTitle"
import { useAPI } from "hooks/useAPI"
import useToolkit from "hooks/useToolkit"
import useLayoutAuth from "pages/Dashboard/hook"
import { APIResponse } from "types/Common"
import { SearchUserType } from "components/Layout/types"
import "./Leaderboard.scss"

type LeaderboardUser = SearchUserType

// Page size for the infinite-scroll leaderboard: 20 initially, +20 per scroll.
const PAGE_SIZE = 20
// Distance (px) from the bottom that triggers loading the next page.
const SCROLL_BOTTOM_THRESHOLD = 80
// Debounce (ms) before firing a user search, matching SearchUserPopup.
const SEARCH_DEBOUNCE_MS = 200

interface NameSegment {
	text: string
	match: boolean
}

interface HighlightedNameProps {
	name: string
	query: string
}

const normalizeForMatch = (value: string) =>
	value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()

const getHighlightSegments = (name: string, query: string): NameSegment[] => {
	const normalizedQuery = normalizeForMatch(query)
	if (!normalizedQuery) return [{ text: name, match: false }]

	const chars = Array.from(name)
	let normalized = ""
	const originIndexByNorm: number[] = []
	chars.forEach((char, index) => {
		for (const normalizedChar of normalizeForMatch(char)) {
			normalized += normalizedChar
			originIndexByNorm.push(index)
		}
	})

	const start = normalized.indexOf(normalizedQuery)
	if (start === -1) return [{ text: name, match: false }]

	const originStart = originIndexByNorm[start]
	const originEnd = originIndexByNorm[start + normalizedQuery.length - 1]

	const segments: NameSegment[] = []
	const before = chars.slice(0, originStart).join("")
	const matched = chars.slice(originStart, originEnd + 1).join("")
	const after = chars.slice(originEnd + 1).join("")
	if (before) segments.push({ text: before, match: false })
	segments.push({ text: matched, match: true })
	if (after) segments.push({ text: after, match: false })
	return segments
}

const HighlightedName = ({ name, query }: HighlightedNameProps) => {
	if (!query) return <>{name}</>

	return (
		<>
			{getHighlightSegments(name, query).map((segment, index) =>
				segment.match
					? <mark key={index} className="leaderboard-highlight">{segment.text}</mark>
					: <span key={index}>{segment.text}</span>
			)}
		</>
	)
}

export default function LeaderboardPage() {
	useAutoTitle("leaderboard.title")
	const { getLeaderboard, searchUsers } = useAPI()
	const { state } = useToolkit()
	const { showProfilePopup } = useLayoutAuth()

	// Leaderboard (infinite scroll). Refs mirror the state used by the scroll
	// handler so it always reads fresh values without re-binding on every render.
	const [users, setUsers] = useState<LeaderboardUser[]>([])
	const [initialLoading, setInitialLoading] = useState(true)
	const [loadingMore, setLoadingMore] = useState(false)
	const offsetRef = useRef(0)
	const loadingRef = useRef(false)
	const hasMoreRef = useRef(true)

	// Search (same behavior as SearchUserPopup: debounced query -> searchUsers).
	const [searchQuery, setSearchQuery] = useState("")
	const [searchResults, setSearchResults] = useState<LeaderboardUser[]>([])
	const [searching, setSearching] = useState(false)
	const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

	const loadMore = async () => {
		if (loadingRef.current || !hasMoreRef.current) return
		loadingRef.current = true
		if (offsetRef.current > 0) setLoadingMore(true)

		try {
			const token = getToken()
			if (!token) return

			const response = await getLeaderboard(
				token,
				offsetRef.current,
				PAGE_SIZE
			) as APIResponse<LeaderboardUser[]>

			if (response?.success && response.data) {
				const page = response.data
				setUsers(prev => [...prev, ...page])
				offsetRef.current += page.length
				hasMoreRef.current = page.length === PAGE_SIZE
			} else {
				hasMoreRef.current = false
			}
		} finally {
			loadingRef.current = false
			setLoadingMore(false)
			setInitialLoading(false)
		}
	}

	useEffect(() => {
		loadMore()
		return () => {
			if (debounceRef.current) clearTimeout(debounceRef.current)
		}
	}, [])

	const handleScroll = (e: UIEvent<HTMLDivElement>) => {
		if (searchQuery.trim()) return
		const el = e.currentTarget
		if (el.scrollHeight - el.scrollTop - el.clientHeight < SCROLL_BOTTOM_THRESHOLD) {
			loadMore()
		}
	}

	const performSearch = async (query: string) => {
		const trimmed = query.trim()
		if (!trimmed) {
			setSearchResults([])
			setSearching(false)
			return
		}

		try {
			const token = getToken()
			if (!token) return

			const response = await searchUsers(token, trimmed, null) as APIResponse<LeaderboardUser[]>
			setSearchResults(response?.success && response.data ? response.data : [])
		} catch {
			setSearchResults([])
		} finally {
			setSearching(false)
		}
	}

	const handleSearchChange = (value: string) => {
		setSearchQuery(value)

		if (debounceRef.current) clearTimeout(debounceRef.current)

		if (!value.trim()) {
			setSearchResults([])
			setSearching(false)
			return
		}

		setSearching(true)
		debounceRef.current = setTimeout(() => performSearch(value), SEARCH_DEBOUNCE_MS)
	}

	const renderRow = (user: LeaderboardUser, rank: number | null, highlight: string) => (
		<ListItem key={user.id} disablePadding>
			<ListItemButton className="leaderboard-row" onClick={() => showProfilePopup(user.id)}>
				{rank !== null && (
					<Typography className={classnames("leaderboard-rank", {
						"top": rank <= 3
					})}>
						{rank}
					</Typography>
				)}
				<UserAvatar
					id={user.id}
					avatar_url={user.avatar_url}
					display_name={user.display_name}
					showPresence
					size={40}
				/>
				<Typography variant="body2" className="leaderboard-name">
					<HighlightedName name={user.display_name} query={highlight} />
				</Typography>
				<Typography variant="body2" className="leaderboard-amount">
					<span className="mr-5">{formatNumber(user.total_amount, state.lang)}</span>
					<i className="fas fa-coins leaderboard-coin" />
				</Typography>
			</ListItemButton>
		</ListItem>
	)

	const isSearchMode = searchQuery.trim().length > 0

	return (
		<Box className="leaderboard-page">
			<TTypography
				variant="h6"
				className="page-title"
				content="leaderboard.title"
			/>
			<Divider sx={{ borderColor: "primary.main" }} />

			<Box className="leaderboard-search">
				<TTextField
					value={searchQuery}
					onChange={e => handleSearchChange(e.target.value)}
					placeholder="leaderboard.search-placeholder"
					size="small"
					fullWidth
				/>
			</Box>

			<Box className="leaderboard-list" onScroll={handleScroll}>
				{isSearchMode ? (
					<>
						{searching && (
							<Box className="leaderboard-loading">
								<CircularProgress size={24} />
							</Box>
						)}
						{!searching && searchResults.length === 0 && (
							<Box className="leaderboard-empty">
								<TTypography
									variant="body2"
									color="text.secondary"
									content="leaderboard.no-results"
								/>
							</Box>
						)}
						{!searching && searchResults.length > 0 && (
							<List className="no-padding">
								{searchResults.map(user => renderRow(user, null, searchQuery.trim()))}
							</List>
						)}
					</>
				) : (
					<>
						{initialLoading && (
							<Box className="leaderboard-skeletons">
								{Array.from({ length: 8 }).map((_, index) => (
									<Box key={index} className="leaderboard-skeleton-row">
										<Skeleton variant="circular" width={40} height={40} />
										<Skeleton variant="text" className="leaderboard-skeleton-name" height={24} />
										<Skeleton variant="text" width={60} height={24} />
									</Box>
								))}
							</Box>
						)}
						{!initialLoading && users.length === 0 && (
							<Box className="leaderboard-empty">
								<TTypography
									variant="body2"
									color="text.secondary"
									content="leaderboard.empty"
								/>
							</Box>
						)}
						{!initialLoading && users.length > 0 && (
							<List className="no-padding">
								{users.map((user, index) => renderRow(user, index + 1, ""))}
							</List>
						)}
						{loadingMore && (
							<Box className="leaderboard-loading">
								<CircularProgress size={24} />
							</Box>
						)}
					</>
				)}
			</Box>
		</Box>
	)
}
