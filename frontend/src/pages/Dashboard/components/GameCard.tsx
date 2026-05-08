import { useNavigate } from "react-router-dom"
import classnames from "classnames"
import {
	Grid,
	Stack,
	Typography
} from "@mui/material"
import { FILTER_KEYS, FILTER_STATUS } from "../constants"
import { TI, TTypography } from "components/TranslationTag"
import { UserAvatarGroup } from "./UserAvatar"
import { GameCardProps } from "../types"

const getStatusKey = (status: number) => {
	if (status === FILTER_STATUS.available) {
		return FILTER_KEYS.available
	}

	if (status === FILTER_STATUS.playing) {
		return FILTER_KEYS.playing
	}

	return "dashboard.status.unknown"
}

const gameStatusClass = (status: number) => classnames({
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

export const GameCard = ({ game }: GameCardProps) => {
	const oldestJoinedUsers = game.users.slice(0, 2)
	const remainingUsers = game.users.slice(2)
	const classIconGameStatus = gameStatusClass(game.status)
	const navigate = useNavigate()

	const handleCardClick = () => {
		navigate(`/game/${game.id}`)
	}

	return (
		<Grid
			key={game.id}
			className="dashboard__game-card"
			size={{ xs: 6, sm: 4, md: 4 }}
			onClick={handleCardClick}
		>
			<Stack spacing={1.5}>
				<Stack direction="row" className="dashboard__card-header">
					<TTypography
						variant="h6"
						fontWeight={700}
						noWrap
						className="dashboard__game-name"
						content={game.name}
					/>
					<i className="fas fa-coin bet-icon" />
					<Typography component="span" className="dashboard__game-bet" noWrap>
						{formatBetAmount(game.bet_amount)}
					</Typography>
				</Stack>

				<Stack direction="row" className="dashboard__card-meta">
					<UserAvatarGroup users={oldestJoinedUsers} type="primary" />
					<TI className={classIconGameStatus} title={getStatusKey(game.status)} />
				</Stack>

				<UserAvatarGroup users={remainingUsers} type="secondary" />
			</Stack>
		</Grid>
	)
}
