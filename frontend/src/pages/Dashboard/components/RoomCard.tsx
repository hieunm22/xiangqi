import classnames from "classnames"
import {
	Grid,
	Stack,
	Typography
} from "@mui/material"
import { FILTER_KEYS, FILTER_STATUS } from "../constants"
import { TI, TTypography } from "components/TranslationTag"
import { UserAvatarGroup } from "./UserAvatar"
import { useJoinRoomDialogContext } from "hooks/useAppContext"
import { RoomCardProps } from "../types"

const getStatusKey = (status: number) => {
	if (status === FILTER_STATUS.available) {
		return FILTER_KEYS.available
	}

	if (status === FILTER_STATUS.playing) {
		return FILTER_KEYS.playing
	}

	return "dashboard.status.unknown"
}

const roomStatusClass = (status: number) => classnames({
	"dashboard__status-icon fas": true,
	"fa-dagger available": status === FILTER_STATUS.available,
	"fa-swords playing": status === FILTER_STATUS.playing
})

const formatBetAmount = (amount?: number) => {
	if (!amount) {
		return "-"
	}

	return amount >= 1000 ? `${amount / 1000}k` : `${amount}`
}

export const RoomCard = ({ room }: RoomCardProps) => {
	const oldestJoinedUsers = room.users.slice(0, 2)
	const remainingUsers = room.users.slice(2)
	const classIconRoomStatus = roomStatusClass(room.status)
	const { openJoinRoom } = useJoinRoomDialogContext()

	const roomCardClass = classnames({
		"dashboard__room-card": true,
		"zero-bet": !room.bet_amount,
		"low": room.bet_amount <= 100 && room.bet_amount > 0,
		"medium": room.bet_amount > 100 && room.bet_amount <= 2000,
		"high": room.bet_amount > 2000
	})

	return (
		<Grid
			key={room.id}
			className={roomCardClass}
			size={{ xs: 6, sm: 4, md: 4 }}
			onClick={() => openJoinRoom(room)}
		>
			<Stack spacing={1.5}>
				<Stack direction="row" className="dashboard__card-header">
					<TTypography
						variant="h6"
						fontWeight={700}
						noWrap
						className="dashboard__room-name"
						content={room.name}
					/>
					{room.bet_amount > 0 && <i className="fas fa-coin bet-icon" />}
					{room.bet_amount > 0 && <Typography component="span" className="dashboard__room-bet">
						{formatBetAmount(room.bet_amount)}
					</Typography>}
				</Stack>

				<Stack direction="row" className="dashboard__card-meta">
					<UserAvatarGroup users={oldestJoinedUsers} type="primary" />
					<TI className={classIconRoomStatus} title={getStatusKey(room.status)} />
				</Stack>

				<UserAvatarGroup users={remainingUsers} type="secondary" />
			</Stack>
		</Grid>
	)
}
