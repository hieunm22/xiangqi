import { useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import classnames from "classnames"
import { Grid, Stack, Typography } from "@mui/material"
import { FILTER_STATUS, GRID_SIZE } from "../constants"
import { TTypography } from "components/TranslationTag"
import { UserAvatarGroup } from "./UserAvatar"
import { getClaimsFromLocalStorage } from "common/helper"
import { openJoinRoom } from "./joinRoomController"
import { RoomCardProps } from "../types"

const formatBetAmount = (amount?: number) => {
	if (!amount) {
		return "-"
	}

	return amount >= 1000 ? `${amount / 1000}k` : `${amount}`
}

export const RoomCard = ({ room }: RoomCardProps) => {
	const containerRef = useRef<HTMLDivElement>(null)
	const [maxVisible, setMaxVisible] = useState(4)

	useEffect(() => {
		const container = containerRef.current
		if (!container) return

		const calculateMaxVisible = () => {
			const availableWidth = (container.firstElementChild as HTMLElement).offsetWidth

			// Avatar: 28px, overlap: -10px
			// Formula: 28 + (N-1) * 18 <= availableWidth
			// N <= (availableWidth - 28) / 18 + 1
			const maxCount = Math.floor((availableWidth - 28) / 18)
			const maxSecondary = Math.max(2, maxCount - 1)

			setMaxVisible(maxSecondary)
		}

		calculateMaxVisible()

		const observer = new ResizeObserver(calculateMaxVisible)
		observer.observe(container)
		return () => observer.disconnect()
	}, [])

	const navigate = useNavigate()
	const oldestJoinedUsers = room.users.filter(u => u.team !== null)
	const remainingUsers = room.users.filter(u => u.team === null)

	const roomCardClass = classnames({
		"dashboard__room-card": true,
		"zero-bet": !room.bet_amount,
		"low": room.bet_amount <= 100 && room.bet_amount > 0,
		"medium": room.bet_amount > 100 && room.bet_amount <= 2000,
		"high": room.bet_amount > 2000,
		"is-available": room.status === FILTER_STATUS.available,
		"is-playing": room.status === FILTER_STATUS.playing,
	})

	const handleOpenJoinRoom = () => {
		const claims = getClaimsFromLocalStorage()
		if (room.users.some(user => user.id === claims?.sub)) {
			navigate(`/room/${room.id}`)
			return
		}
		openJoinRoom(room)
	}

	return (
		<Grid
			key={room.id}
			className={roomCardClass}
			size={GRID_SIZE}
			ref={containerRef}
			onClick={handleOpenJoinRoom}
		>
			<Stack spacing={1.5}>
				<Stack direction="row" className="dashboard__card-header">
					<TTypography
						variant="h6"
						sx={{ fontWeight: 700 }}
						noWrap
						className="dashboard__room-name"
						content={room.name}
					/>
					{room.bet_amount > 0 && <i className="fas fa-coin bet-icon" />}
					{room.bet_amount > 0 && (
						<Typography component="span" className="dashboard__room-bet">
							{formatBetAmount(room.bet_amount)}
						</Typography>
					)}
				</Stack>

				<Stack direction="row" className="dashboard__card-meta">
					<UserAvatarGroup
						users={oldestJoinedUsers}
						type="primary"
						maxVisible={2}
					/>
					<Typography component="span" className="dashboard__room-time">
						<i className="far fa-clock" />
						{room.time_limit
							? `${Math.round(room.time_limit / 60)}'`
							: <i className="fas fa-infinity" />}
					</Typography>
				</Stack>

				<UserAvatarGroup
					users={remainingUsers}
					type="secondary"
					maxVisible={maxVisible}
				/>
			</Stack>
		</Grid>
	)
}
