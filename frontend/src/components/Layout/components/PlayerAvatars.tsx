import { Avatar, Stack, Tooltip } from "@mui/material"
import { requireImage } from "common/helper"
import { GameHistoryItem, PlayerAvatarsProps } from "../types"

const getWinnerUserId = (game: GameHistoryItem, currentUserId: number) => {
	if (game.amount === 0 || !currentUserId) {
		return null
	}

	const users = game.users.slice(0, 2)
	if (users.length < 2 || !users.some(user => user.id === currentUserId)) {
		return null
	}

	if (game.amount > 0) {
		return currentUserId
	}

	const findUser = users.find(user => user.id !== currentUserId)
	return findUser ? findUser.id : null
}

export const PlayerAvatars = ({ game, userId: currentUserId }: PlayerAvatarsProps) => {
	const winnerUserId = getWinnerUserId(game, currentUserId)

	return (
		<Stack direction="row" spacing={1} sx={{ alignItems: "center", justifyContent: "flex-start" }}>
			{game.users.slice(0, 2).map(user => {
				const isWinner = winnerUserId === user.id

				return (
					<Tooltip key={user.id} title={user.display_name} arrow placement="top">
						<Avatar
							src={requireImage(user.avatar_url)}
							alt={user.display_name}
							sx={{
								width: 40,
								height: 40,
								boxShadow: isWinner ? "0 0 0 2px #d0461c, 0 4px 10px rgba(0,0,0,0.25)" : "none",
								opacity: isWinner ? 1 : 0.3
							}}
						>
							{user.display_name.trim().charAt(0).toUpperCase() || "U"}
						</Avatar>
					</Tooltip>
				)
			})}
		</Stack>
	)
}